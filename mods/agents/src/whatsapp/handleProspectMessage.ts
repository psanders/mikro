/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Handles an inbound WhatsApp message from a prospect with a partial loan
 * application and invokes José. Stateless: the conversation so far comes in as
 * `history` (read from the persisted transcript), and the turn counters are
 * derived from it, so an intake survives an apiserver restart.
 */
import type { Agent, Message, ToolExecuted } from "../llm/types.js";
import type { InvokeLLMResult } from "../llm/createInvokeLLM.js";
import { isNewSessionFrom } from "../conversations/index.js";
import { getSessionTimeoutSeconds } from "../config.js";
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
  /** The DRAFT's id; lets José's tools (e.g. requestHumanHandoff) name it. */
  applicationId?: string;
  /** José's conversation with this prospect so far, oldest first (no SYSTEM turns). */
  history: Message[];
  /**
   * `intake` (default): a DRAFT José gets submitted. `enrichment`: already
   * submitted; José keeps asking the remaining fields (openspec
   * jose-keep-gathering). Decides which directives apply.
   */
  phase?: "intake" | "enrichment";
  /** The turn's image (enrichment only: José takes the applicant's documents). */
  imageUrl?: string | null;
  /** A username sender's BSUID, so a hand-off from José can find them later. */
  whatsappUserId?: string;
}

/**
 * José submits a DRAFT by this reply at the latest (earlier when the simulated
 * score reaches the prompt's threshold), so a lead is never lost to a long
 * conversation. It is not an end point: after submitting he keeps asking the
 * remaining fields while the person answers (openspec jose-keep-gathering).
 */
export const SUBMIT_BY_TURN = 7;

/**
 * Conservative detector for an explicit "not interested" / opt-out message.
 * Kept tight to avoid false positives on plain "no" answers to yes/no intake
 * questions — it requires a clear withdrawal phrase. José still handles softer
 * declines conversationally; this is the deterministic backstop.
 */
const DECLINE_RE =
  /\b(no me interesa|ya no me interesa|no estoy interesad|perdí el interés|no quiero (el préstamo|el credito|el crédito|seguir|continuar|nada|ningún)|ya no quiero|no deseo continuar|déjame (tranquilo|en paz)|déjenme (tranquilo|en paz)|no, gracias|cancela(r| mi solicitud)?)\b/i;

export function isDecline(message: string): boolean {
  return DECLINE_RE.test(message);
}

function savedThisTurn(message: Message): boolean {
  return (message.tools_executed ?? []).some((t) => t.name === "saveAnswer");
}

/**
 * The counters the directives key off, derived from the history: how many
 * replies José has sent, and how many of the latest ones saved nothing.
 */
function countTurns(history: Message[]): { joseTurns: number; turnsSinceLastSave: number } {
  const replies = history.filter((m) => m.role === "assistant");
  let turnsSinceLastSave = 0;
  for (let i = replies.length - 1; i >= 0 && !savedThisTurn(replies[i]); i--) {
    turnsSinceLastSave++;
  }
  return { joseTurns: replies.length, turnsSinceLastSave };
}

export async function handleProspectMessage(
  phone: string,
  sessionId: string,
  userMessage: string,
  deps: ProspectMessageDeps
): Promise<{ text: string; toolsExecuted: ToolExecuted[] }> {
  const { invokeLLM, joseAgent, history } = deps;
  const phase = deps.phase ?? "intake";
  const session = countTurns(history);
  const newSession = isNewSessionFrom(history, getSessionTimeoutSeconds());
  const effectiveMessage = directiveFor(phase, userMessage, session) + userMessage;
  if (effectiveMessage !== userMessage) {
    logger.verbose("jose directive injected", { phone, phase, ...session });
  }

  const context: Record<string, unknown> = {
    sessionId,
    phone,
    profile: "PROSPECT",
    ...(deps.applicationId ? { applicationId: deps.applicationId } : {}),
    ...(phase === "enrichment" ? { submitted: true } : {}),
    ...(deps.whatsappUserId ? { whatsappUserId: deps.whatsappUserId } : {}),
    ...(deps.imageUrl ? { imageDataUrl: deps.imageUrl } : {})
  };

  logger.verbose("handling prospect message", {
    phone,
    sessionId,
    newSession,
    turnsSinceLastSave: session.turnsSinceLastSave
  });

  const result = await invokeLLM(
    joseAgent,
    history,
    effectiveMessage,
    deps.imageUrl ?? null,
    context,
    newSession
  );

  const responseText = typeof result === "string" ? result : result.text;
  const toolsExecuted: ToolExecuted[] =
    typeof result === "string" ? [] : (result.toolsExecuted ?? []);

  return { text: responseText, toolsExecuted };
}

/**
 * The system note prepended to the prospect's message, by phase. Precedence:
 * an explicit decline first, then (intake) the submit-by turn, then the stuck
 * counter. A decline or a stuck conversation abandons a DRAFT but never
 * un-submits an application: after submission it only ends José's questions.
 */
function directiveFor(
  phase: "intake" | "enrichment",
  userMessage: string,
  session: { joseTurns: number; turnsSinceLastSave: number }
): string {
  if (phase === "intake") {
    if (isDecline(userMessage)) {
      return (
        `[SISTEMA: El prospecto indicó que NO está interesado o no quiere continuar. ` +
        `Despídete de forma breve y respetuosa, NO hagas más preguntas, NO repitas la pregunta ` +
        `anterior, y llama finalizeApplication con outcome "abandoned".] `
      );
    }
    if (session.joseTurns >= SUBMIT_BY_TURN - 1) {
      return (
        `[SISTEMA: Es momento de enviar la solicitud. Primero guarda con saveAnswer cualquier ` +
        `dato útil de este mensaje y llama finalizeApplication con outcome "complete". En tu ` +
        `respuesta confirma que la solicitud quedó recibida y ofrece, como algo opcional, seguir ` +
        `con unas preguntas más para completarla: pregunta los siguientes 2 o 3 campos de ` +
        `missingFields.] `
      );
    }
    if (session.turnsSinceLastSave >= 3) {
      return (
        `[SISTEMA: El prospecto lleva ${session.turnsSinceLastSave} turnos sin responder preguntas de intake. ` +
        `Si este mensaje tampoco contiene datos útiles para guardar, despídete y llama ` +
        `finalizeApplication con outcome "abandoned".] `
      );
    }
    return "";
  }

  // Enrichment: the application is already submitted.
  if (isDecline(userMessage)) {
    return (
      `[SISTEMA: FASE 2. La persona no quiere responder más preguntas. Su solicitud YA está ` +
      `enviada y NO se cancela. Agradece, dile que el equipo la está revisando, llama ` +
      `finalizeApplication para cerrar tus preguntas y no preguntes nada más.] `
    );
  }
  if (session.turnsSinceLastSave >= 3) {
    return (
      `[SISTEMA: FASE 2. La persona lleva ${session.turnsSinceLastSave} mensajes sin darte datos nuevos. ` +
      `Si este tampoco trae datos para guardar, agradece, llama finalizeApplication para cerrar ` +
      `tus preguntas y no preguntes más. La solicitud sigue enviada.] `
    );
  }
  if (session.joseTurns === 0) {
    return (
      `[SISTEMA: FASE 2. Esta persona ya envió su solicitud (por el formulario web) y es tu ` +
      `primer mensaje con ella. Llama getApplicationState, saluda en nombre del equipo de ` +
      `Mikro Créditos (sin decir tu nombre), confirma que ` +
      `recibimos su solicitud y ofrece, como algo opcional, completarla con unas preguntas más: ` +
      `pregunta los primeros 2 o 3 campos de missingFields. Si pregunta por el estado, usa ` +
      `getMyApplicationStatus.] `
    );
  }
  return `[SISTEMA: FASE 2. La solicitud ya está enviada.] `;
}
