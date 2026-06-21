/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Handles an inbound WhatsApp message from a prospect with a partial loan
 * application. Manages phone-keyed in-memory session state and invokes José.
 */
import type { Agent, Message, ToolExecuted } from "../llm/types.js";
import type { InvokeLLMResult } from "../llm/createInvokeLLM.js";
import { isNewSession, touchSession } from "../sessions/index.js";
import { logger } from "../logger.js";

export interface ProspectMessageDeps {
  invokeLLM: (
    agent: Agent,
    messages: Message[],
    userMessage: string,
    imageUrl?: string | null,
    context?: Record<string, unknown>,
    isNewSession?: boolean
  ) => Promise<InvokeLLMResult>;
  joseAgent: Agent;
}

/**
 * Hard cap on the number of messages José sends in one intake conversation.
 * The closing message is the last (7th) turn, so José has at most 6 turns to
 * collect data. This guarantees a short form regardless of ISC progress —
 * José finalizes earlier if simulatedIsc reaches the target threshold.
 */
const MAX_JOSE_TURNS = 7;

/**
 * Conservative detector for an explicit "not interested" / opt-out message.
 * Kept tight to avoid false positives on plain "no" answers to yes/no intake
 * questions — it requires a clear withdrawal phrase. José still handles softer
 * declines conversationally; this is the deterministic backstop.
 */
const DECLINE_RE =
  /\b(no me interesa|ya no me interesa|no estoy interesad|perdí el interés|no quiero (el préstamo|el credito|el crédito|seguir|continuar|nada|ningún)|ya no quiero|no deseo continuar|déjame (tranquilo|en paz)|déjenme (tranquilo|en paz)|no, gracias|cancela(r| mi solicitud)?)\b/i;

function isDecline(message: string): boolean {
  return DECLINE_RE.test(message);
}

interface ProspectSession {
  history: Message[];
  turnsSinceLastSave: number;
  /** Count of replies José has produced in this conversation. */
  joseTurns: number;
}

/** In-memory phone → session for prospects. */
const prospectSessions = new Map<string, ProspectSession>();

function getSession(phone: string): ProspectSession {
  if (!prospectSessions.has(phone)) {
    prospectSessions.set(phone, { history: [], turnsSinceLastSave: 0, joseTurns: 0 });
  }
  return prospectSessions.get(phone)!;
}

function savedThisTurn(_assistantMessage: string, toolsExecuted: ToolExecuted[]): boolean {
  return toolsExecuted.some((t) => t.name === "saveAnswer");
}

export async function handleProspectMessage(
  phone: string,
  sessionId: string,
  userMessage: string,
  deps: ProspectMessageDeps
): Promise<{ text: string }> {
  const { invokeLLM, joseAgent } = deps;
  const session = getSession(phone);
  const newSession = isNewSession(phone);

  // Inject a directive into userMessage based on conversation state. Precedence:
  // an explicit decline closes the conversation as ABANDONED no matter what
  // (highest); then the hard turn cap (final allowed turn must close out as
  // complete); then the stuck counter (no useful answers → abandoned).
  let effectiveMessage = userMessage;
  const isFinalTurn = session.joseTurns >= MAX_JOSE_TURNS - 1;
  if (isDecline(userMessage)) {
    effectiveMessage =
      `[SISTEMA: El prospecto indicó que NO está interesado o no quiere continuar. ` +
      `Despídete de forma breve y respetuosa, NO hagas más preguntas, NO repitas la pregunta ` +
      `anterior, y llama finalizeApplication con outcome "abandoned".] ` +
      userMessage;
    logger.verbose("jose decline detected, forcing abandon", { phone });
  } else if (isFinalTurn) {
    effectiveMessage =
      `[SISTEMA: Límite de turnos alcanzado. Esta es tu última respuesta. ` +
      `Primero guarda con saveAnswer cualquier dato útil en este mensaje, luego llama ` +
      `finalizeApplication con outcome "complete" y responde SOLO con el mensaje de cierre. ` +
      `No hagas más preguntas.] ` +
      userMessage;
    logger.verbose("jose turn cap reached, forcing finalize", {
      phone,
      joseTurns: session.joseTurns
    });
  } else if (session.turnsSinceLastSave >= 3) {
    effectiveMessage =
      `[SISTEMA: El prospecto lleva ${session.turnsSinceLastSave} turnos sin responder preguntas de intake. ` +
      `Si este mensaje tampoco contiene datos útiles para guardar, despídete y llama ` +
      `finalizeApplication con outcome "abandoned".] ` +
      userMessage;
    logger.verbose("jose stuck warning injected", {
      phone,
      turnsSinceLastSave: session.turnsSinceLastSave
    });
  }

  const context: Record<string, unknown> = { sessionId, phone };

  logger.verbose("handling prospect message", {
    phone,
    sessionId,
    newSession,
    turnsSinceLastSave: session.turnsSinceLastSave
  });

  const result = await invokeLLM(
    joseAgent,
    session.history,
    effectiveMessage,
    null,
    context,
    newSession
  );
  touchSession(phone);

  const responseText = typeof result === "string" ? result : result.text;
  const toolsExecuted: ToolExecuted[] =
    typeof result === "string" ? [] : (result.toolsExecuted ?? []);

  // Count this José reply against the hard turn cap.
  session.joseTurns += 1;

  // Update stuck counter
  if (savedThisTurn(responseText, toolsExecuted)) {
    session.turnsSinceLastSave = 0;
  } else {
    session.turnsSinceLastSave += 1;
  }

  session.history.push({ role: "user", content: userMessage }); // store original, not injected
  session.history.push({
    role: "assistant",
    content: responseText,
    tools_executed: toolsExecuted.length > 0 ? toolsExecuted : undefined
  });

  return { text: responseText };
}

/** Clear session for a phone (used after finalization to stop intake). */
export function clearProspectHistory(phone: string): void {
  prospectSessions.delete(phone);
}
