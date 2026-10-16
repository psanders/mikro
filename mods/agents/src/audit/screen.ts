/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Layered audit judge (openspec decision-judges): the decision model screens
 * every agent turn against every policy (one yes/no per policy, one request
 * per turn); only the policies it flags, or is unsure about, go to the LLM
 * judge, which confirms and quotes the evidence. Same `JudgeConversation`
 * contract as the whole-conversation judge, so `runAudit` is unchanged.
 */
import type { AgentPolicy } from "../llm/types.js";
import type { DecisionProvider } from "../decisions/index.js";
import { DECISION_MIN_CONFIDENCE } from "../decisions/index.js";
import type { AuditConversation, AuditTurn, JudgeConversation, JudgeVerdict } from "./types.js";

/** Earlier turns shown with each agent turn. */
export const SCREEN_CONTEXT_TURNS = 6;

const SPEAKER: Record<AuditTurn["role"], string> = {
  INBOUND: "PERSONA",
  AGENT: "AGENTE",
  SYSTEM: "SISTEMA"
};
const SIGNATURE_RE = /\s*\^[A-Z]{2}\s*$/;

export interface ScreenStats {
  conversations: number;
  turnsScreened: number;
  decisionCalls: number;
  decisionInputTokens: number;
  decisionLatencyMs: number;
  /** (turn, policy) pairs the screen flagged or was unsure about. */
  flags: number;
  confirmCalls: number;
}

export interface ScreenFlag {
  phone: string;
  turnId: number;
  policyId: string;
  probability: number;
}

export function newScreenStats(): ScreenStats {
  return {
    conversations: 0,
    turnsScreened: 0,
    decisionCalls: 0,
    decisionInputTokens: 0,
    decisionLatencyMs: 0,
    flags: 0,
    confirmCalls: 0
  };
}

/** What the decision model reads for one agent turn. */
export function screenInput(conversation: AuditConversation, index: number): string {
  const turn = conversation.turns[index]!;
  const before = conversation.turns.slice(Math.max(0, index - SCREEN_CONTEXT_TURNS), index);
  const line = (t: AuditTurn) =>
    `${SPEAKER[t.role]}: ${t.content.replace(SIGNATURE_RE, "").trim() || "(sin texto)"}`;
  return [
    before.length
      ? `CONVERSACIÓN PREVIA:\n${before.map(line).join("\n")}`
      : "CONVERSACIÓN PREVIA: (ninguna)",
    `MENSAJE DEL AGENTE A REVISAR: ${turn.content.replace(SIGNATURE_RE, "").trim() || "(sin texto)"}`,
    `HERRAMIENTAS QUE EJECUTÓ EN ESE TURNO: ${turn.toolNames.length ? turn.toolNames.join(", ") : "ninguna"}`
  ].join("\n\n");
}

export interface DecisionScreenDeps {
  decisions: DecisionProvider;
  /** The LLM judge that confirms flagged policies and quotes the evidence. */
  confirm: JudgeConversation;
  /** A policy is flagged when P(incumple) is at least 1 − threshold (yes or unsure). */
  threshold?: number;
  stats?: ScreenStats;
  onFlag?: (flag: ScreenFlag) => void;
}

export function createDecisionScreenJudge(deps: DecisionScreenDeps): JudgeConversation {
  const flagAt = 1 - (deps.threshold ?? DECISION_MIN_CONFIDENCE);
  return async (conversation, agent) => {
    if (deps.stats) deps.stats.conversations += 1;
    const flagged = new Map<string, AgentPolicy>();
    for (let i = 0; i < conversation.turns.length; i++) {
      const turn = conversation.turns[i]!;
      if (turn.context || turn.role !== "AGENT" || turn.failed || !turn.content.trim()) continue;
      const result = await deps.decisions.ask(
        screenInput(conversation, i),
        agent.policies.map((p) => ({
          type: "predicate" as const,
          name: p.id,
          instructions: `El MENSAJE DEL AGENTE A REVISAR incumple esta regla: ${p.rule}`
        }))
      );
      if (deps.stats) {
        deps.stats.turnsScreened += 1;
        deps.stats.decisionCalls += 1;
        deps.stats.decisionInputTokens += result.inputTokens;
        deps.stats.decisionLatencyMs += result.latencyMs;
      }
      for (const policy of agent.policies) {
        const answer = result.answers.find((a) => a.name === policy.id);
        // A refusal is as good as unsure: let the LLM look.
        const probability = answer?.type === "predicate" ? answer.probability : 1;
        if (probability < flagAt) continue;
        flagged.set(policy.id, policy);
        if (deps.stats) deps.stats.flags += 1;
        deps.onFlag?.({
          phone: conversation.phone,
          turnId: turn.id,
          policyId: policy.id,
          probability
        });
      }
    }
    if (flagged.size === 0) return [];
    if (deps.stats) deps.stats.confirmCalls += 1;
    const verdicts: JudgeVerdict[] = await deps.confirm(conversation, {
      name: agent.name,
      policies: [...flagged.values()]
    });
    return verdicts;
  };
}
