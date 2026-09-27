/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Deterministic conversation checks: the audit's code layer. Cheap, no AI,
 * run over every reviewed conversation. Each check returns the turns it
 * flags; `runChecks` turns them into findings. Mirrors the collections check
 * registry in @mikro/common (id, title, severity, run).
 */
import { isHumanRequest, PROCESSING_ERROR_REPLY } from "../whatsapp/handleWhatsAppMessage.js";
import type { AuditConversation, AuditFinding, AuditSeverity, AuditTurn } from "./types.js";

export interface CheckHit {
  turn: AuditTurn;
  reason: string;
}

export interface ConversationCheck {
  id: string;
  title: string;
  severity: AuditSeverity;
  run(conversation: AuditConversation): CheckHit[];
}

/** A hand-off opened this close to a request for a person counts as honoring it. */
const HANDOFF_BEFORE_MS = 60_000;
const HANDOFF_AFTER_MS = 10 * 60_000;

/** A score or band stated with a number ("tu puntaje es 74", "banda B 3"). */
const SCORE_RE = /\b(puntaje|puntuaci[oó]n|score|banda)\b[^.\n]{0,25}?\b\d{1,3}\b/i;

const inWindow = (t: AuditTurn) => !t.context;

export const CONVERSATION_CHECKS: ConversationCheck[] = [
  {
    id: "failed_send",
    title: "Mensaje no entregado",
    severity: "WARNING",
    run: (c) =>
      c.turns
        .filter((t) => inWindow(t) && t.role !== "INBOUND" && t.failed)
        .map((turn) => ({ turn, reason: "El envío falló; la persona no recibió la respuesta." }))
  },
  {
    id: "error_reply",
    title: "Respondió con el mensaje de error",
    severity: "WARNING",
    run: (c) =>
      c.turns
        .filter((t) => inWindow(t) && t.role === "SYSTEM" && t.content === PROCESSING_ERROR_REPLY)
        .map((turn) => ({
          turn,
          reason: "Falló el procesamiento del mensaje y se envió el texto de error genérico."
        }))
  },
  {
    id: "handoff_ignored",
    title: "Pidió una persona y no se traspasó",
    severity: "WARNING",
    run: (c) =>
      c.turns
        .filter((t) => inWindow(t) && t.role === "INBOUND" && isHumanRequest(t.content))
        .filter((t) => {
          const at = t.createdAt.getTime();
          return !c.handoffsOpenedAt.some((h) => {
            const opened = h.getTime();
            return opened >= at - HANDOFF_BEFORE_MS && opened <= at + HANDOFF_AFTER_MS;
          });
        })
        .map((turn) => ({
          turn,
          reason: "Pidió hablar con una persona y no se abrió un traspaso."
        }))
  },
  {
    id: "sensitive_score",
    title: "Reveló el puntaje",
    severity: "CRITICAL",
    run: (c) =>
      c.turns
        .filter((t) => inWindow(t) && t.role === "AGENT" && SCORE_RE.test(t.content))
        .map((turn) => ({
          turn,
          reason:
            "La respuesta menciona un puntaje o banda con número; no se comparte con la persona."
        }))
  }
];

/** The agent a finding is attributed to: the turn's own, else the conversation's latest. */
export function servingAgentOf(
  conversation: AuditConversation,
  turn?: AuditTurn
): Pick<AuditTurn, "agentName" | "agentVersion" | "profile"> {
  if (turn?.agentName) return turn;
  const lastAgent = [...conversation.turns].reverse().find((t) => t.agentName);
  return {
    agentName: lastAgent?.agentName ?? null,
    agentVersion: lastAgent?.agentVersion ?? null,
    profile: turn?.profile ?? lastAgent?.profile ?? null
  };
}

/** Ids of the application and customer a conversation is about (latest known). */
export function subjectOf(conversation: AuditConversation): {
  applicationId: string | null;
  customerId: string | null;
} {
  const reversed = [...conversation.turns].reverse();
  return {
    applicationId: reversed.find((t) => t.applicationId)?.applicationId ?? null,
    customerId: reversed.find((t) => t.customerId)?.customerId ?? null
  };
}

/** Run every code check over one conversation. */
export function runChecks(
  conversation: AuditConversation,
  checks: ConversationCheck[] = CONVERSATION_CHECKS
): AuditFinding[] {
  const subject = subjectOf(conversation);
  return checks.flatMap((check) =>
    check.run(conversation).map(({ turn, reason }) => {
      const agent = servingAgentOf(conversation, turn);
      return {
        phone: conversation.phone,
        applicationId: turn.applicationId ?? subject.applicationId,
        customerId: turn.customerId ?? subject.customerId,
        profile: agent.profile,
        agentName: agent.agentName,
        agentVersion: agent.agentVersion,
        checkId: check.id,
        source: "CODE" as const,
        severity: check.severity,
        rule: check.title,
        turnId: turn.id,
        evidence: turn.content,
        reason
      };
    })
  );
}
