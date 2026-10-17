/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Deterministic conversation checks: the audit's code layer. Cheap, no AI,
 * run over every reviewed conversation. Each check returns the turns it
 * flags; `runChecks` turns them into findings. Mirrors the collections check
 * registry in @mikro/common (id, title, severity, run).
 */
import { isHumanRequest, PROCESSING_ERROR_REPLY } from "../whatsapp/handleWhatsAppMessage.js";
import { DECISION_MIN_CONFIDENCE } from "../decisions/verdict.js";
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

/** Two replies to the same message closer than this are a double reply. */
const DOUBLE_REPLY_MS = 90_000;
/** A message left without any reply for longer than this is unanswered. */
const UNANSWERED_AFTER_MS = 10 * 60_000;
/** A hand-off covers silence for this long (its TTL). */
const HANDOFF_COVERS_MS = 24 * 60 * 60_000;
/** Consecutive agent replies this similar count as the same request repeated. */
const SAME_REQUEST_SIMILARITY = 0.45;
const STUCK_AFTER_REPEATS = 3;

const WORD_RE = /[a-záéíóúñü]{4,}/g;
const SIGNATURE_RE = /\s*\^[A-Z]{2}\s*$/;

/** Content words of a reply, for comparing two replies. */
function words(text: string): Set<string> {
  return new Set(text.replace(SIGNATURE_RE, "").toLowerCase().match(WORD_RE) ?? []);
}

/** Fewer content words than this can't show a repeated request ("Perfecto ^JO"). */
const MIN_COMPARABLE_WORDS = 3;

/** Overlap of two replies' content words (0–1). */
export function replySimilarity(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  if (x.size < MIN_COMPARABLE_WORDS || y.size < MIN_COMPARABLE_WORDS) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared += 1;
  return shared / Math.min(x.size, y.size);
}

const isReply = (t: AuditTurn) => (t.role === "AGENT" || t.role === "SYSTEM") && !t.failed;
/**
 * An AGENT turn that reached the person. A tool-only turn (no text) is stored
 * with empty content and sent nothing.
 */
const isSentAgentReply = (t: AuditTurn) =>
  t.role === "AGENT" && !t.failed && t.content.trim() !== "";
/** A confidently labeled closing after the agent had settled the matter. */
const isSettledClosing = (t: AuditTurn) =>
  t.intent === "closing" &&
  (t.intentConfidence ?? 0) >= DECISION_MIN_CONFIDENCE &&
  (t.settled ?? 0) >= DECISION_MIN_CONFIDENCE;

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
    id: "double_reply",
    title: "Respondió dos veces al mismo mensaje",
    severity: "WARNING",
    run: (c) => {
      const hits: CheckHit[] = [];
      // Only messages that reached the person: a failed send or a tool-only turn isn't a reply.
      const turns = c.turns.filter((t) => t.role !== "AGENT" || isSentAgentReply(t));
      for (let i = 1; i < turns.length; i++) {
        const prev = turns[i - 1]!;
        const turn = turns[i]!;
        if (!inWindow(turn) || turn.role !== "AGENT" || prev.role !== "AGENT") continue;
        if (turn.createdAt.getTime() - prev.createdAt.getTime() > DOUBLE_REPLY_MS) continue;
        hits.push({
          turn,
          reason: "Dos respuestas seguidas sin un mensaje de la persona entre ellas."
        });
      }
      return hits;
    }
  },
  {
    id: "stuck_loop",
    title: "Repitió lo mismo sin avanzar",
    severity: "WARNING",
    run: (c) => {
      const replies = c.turns.filter(isSentAgentReply);
      const hits: CheckHit[] = [];
      let streak = 1;
      for (let i = 1; i < replies.length; i++) {
        const same =
          replySimilarity(replies[i - 1]!.content, replies[i]!.content) >= SAME_REQUEST_SIMILARITY;
        streak = same ? streak + 1 : 1;
        if (streak === STUCK_AFTER_REPEATS && inWindow(replies[i]!)) {
          hits.push({
            turn: replies[i]!,
            reason: `El agente repitió la misma petición ${STUCK_AFTER_REPEATS} veces seguidas sin pasar a una persona.`
          });
        }
      }
      return hits;
    }
  },
  {
    id: "unanswered",
    title: "Mensaje sin respuesta",
    severity: "WARNING",
    run: (c) => {
      // A tool-only AGENT turn sent nothing, so it doesn't answer the message before it.
      const last = c.turns.filter((t) => t.role !== "AGENT" || isSentAgentReply(t)).at(-1);
      if (!last || !inWindow(last) || last.role !== "INBOUND" || !c.asOf) return [];
      const at = last.createdAt.getTime();
      if (c.asOf.getTime() - at < UNANSWERED_AFTER_MS) return [];
      // A closing needs no answer; an open hand-off means a person has it.
      if (isSettledClosing(last)) return [];
      if (
        c.handoffsOpenedAt.some((h) => h.getTime() <= at && at - h.getTime() < HANDOFF_COVERS_MS)
      ) {
        return [];
      }
      const lastReply = [...c.turns].reverse().find(isReply);
      return [
        {
          turn: last,
          reason: lastReply
            ? "El último mensaje de la persona no recibió respuesta."
            : "La persona escribió y nunca recibió respuesta."
        }
      ];
    }
  },
  {
    id: "closing_loop",
    title: "Siguió respondiendo a despedidas",
    severity: "WARNING",
    run: (c) => {
      const hits: CheckHit[] = [];
      // Per agent reply: did it answer only settled closings? Messages of one
      // burst share a reply, so the streak counts replies, not messages.
      let streak = 0;
      let pending: AuditTurn[] = [];
      for (const t of c.turns) {
        if (t.role === "INBOUND") {
          pending.push(t);
          continue;
        }
        if (!isSentAgentReply(t) || pending.length === 0) continue;
        streak = pending.every(isSettledClosing) ? streak + 1 : 0;
        pending = [];
        if (streak === 2 && inWindow(t)) {
          hits.push({
            turn: t,
            reason:
              "Respondió de nuevo a un agradecimiento o despedida cuando el asunto ya estaba resuelto."
          });
        }
      }
      return hits;
    }
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
