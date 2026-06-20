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

interface ProspectSession {
  history: Message[];
  turnsSinceLastSave: number;
}

/** In-memory phone → session for prospects. */
const prospectSessions = new Map<string, ProspectSession>();

function getSession(phone: string): ProspectSession {
  if (!prospectSessions.has(phone)) {
    prospectSessions.set(phone, { history: [], turnsSinceLastSave: 0 });
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

  // Inject stuck-counter warning into userMessage when close to threshold
  let effectiveMessage = userMessage;
  if (session.turnsSinceLastSave >= 3) {
    effectiveMessage =
      `[SISTEMA: El prospecto lleva ${session.turnsSinceLastSave} turnos sin responder preguntas de intake. ` +
      `Si este mensaje tampoco contiene datos útiles para guardar, llama finalizeApplication ahora.] ` +
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
