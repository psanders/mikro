/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Layered audit judge (openspec decision-judges). The decision model screens
 * every agent turn against every screenable policy (one yes/no per policy, one
 * request per turn). Only what it flags reaches an LLM, one focused question
 * per flagged (turn, policy) — "does this message do what the rule forbids?" —
 * which confirms it with a reason; the turn itself is the evidence. Policies
 * the decision model can't judge from one message (`screen: false`) are graded
 * by the whole-conversation judge, only for conversations already escalated.
 *
 * Same `JudgeConversation` contract as the whole-conversation judge, so
 * `runAudit` is unchanged. Experiment 2026-10-16 (305 stored turns): the
 * whole-conversation judge found 0 of 13 hand-labeled violations; this layout
 * found 8 and sent 10 of 27 conversations to the LLM.
 */
import type { AgentPolicy } from "../llm/types.js";
import type { DecisionProvider } from "../decisions/index.js";
import { DECISION_MIN_CONFIDENCE } from "../decisions/index.js";
import type { CheckLlmJudge } from "../decisions/llmCheck.js";
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
  /** (turn, policy) pairs the screen flagged. */
  flags: number;
  /** Focused LLM confirmations asked. */
  confirmCalls: number;
  /** Whole-conversation judge calls for unscreened policies. */
  conversationJudgeCalls: number;
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
    confirmCalls: 0,
    conversationJudgeCalls: 0
  };
}

/** What the decision model (and the focused confirm) read for one agent turn. */
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

/**
 * The question for one rule. Rules are written as prohibitions ("No da
 * fechas…"); asking whether a message "incumple" one confused the decision
 * model (double negative), so the question names what the rule forbids.
 */
export function policyQuestion(policy: Pick<AgentPolicy, "rule">): string {
  return `La regla del agente dice: «${policy.rule}». ¿El MENSAJE DEL AGENTE A REVISAR hace lo que esta regla prohíbe, o deja de hacer lo que exige?`;
}

export interface DecisionScreenDeps {
  decisions: DecisionProvider;
  /** Confirms one flagged (turn, policy) with a reason (focused LLM question). */
  confirmTurn: CheckLlmJudge;
  /** Grades `screen: false` policies over the whole conversation, when escalated. */
  conversationJudge?: JudgeConversation;
  /** Flag a policy when P(breaks it) reaches this. */
  threshold?: number;
  stats?: ScreenStats;
  onFlag?: (flag: ScreenFlag) => void;
}

export function createDecisionScreenJudge(deps: DecisionScreenDeps): JudgeConversation {
  const flagAt = deps.threshold ?? DECISION_MIN_CONFIDENCE;
  return async (conversation, agent) => {
    if (deps.stats) deps.stats.conversations += 1;
    const screened = agent.policies.filter((p) => p.screen !== false);
    const unscreened = agent.policies.filter((p) => p.screen === false);
    const flags: Array<{ index: number; turn: AuditTurn; policy: AgentPolicy }> = [];

    for (let i = 0; i < conversation.turns.length && screened.length > 0; i++) {
      const turn = conversation.turns[i]!;
      if (turn.context || turn.role !== "AGENT" || turn.failed || !turn.content.trim()) continue;
      // Rules belong to the agent that wrote the turn, not whoever served last.
      if (turn.agentName && turn.agentName !== agent.name) continue;
      const result = await deps.decisions.ask(
        screenInput(conversation, i),
        screened.map((p) => ({
          type: "predicate" as const,
          name: p.id,
          instructions: policyQuestion(p)
        }))
      );
      if (deps.stats) {
        deps.stats.turnsScreened += 1;
        deps.stats.decisionCalls += 1;
        deps.stats.decisionInputTokens += result.inputTokens;
        deps.stats.decisionLatencyMs += result.latencyMs;
      }
      for (const policy of screened) {
        const answer = result.answers.find((a) => a.name === policy.id);
        // A refusal is as good as a flag: let the LLM look.
        const probability = answer?.type === "predicate" ? answer.probability : 1;
        if (probability < flagAt) continue;
        flags.push({ index: i, turn, policy });
        if (deps.stats) deps.stats.flags += 1;
        deps.onFlag?.({
          phone: conversation.phone,
          turnId: turn.id,
          policyId: policy.id,
          probability
        });
      }
    }

    const verdicts: JudgeVerdict[] = [];
    const failed = new Set<string>();
    for (const flag of flags) {
      if (failed.has(flag.policy.id)) continue; // one finding per policy per conversation
      if (deps.stats) deps.stats.confirmCalls += 1;
      const confirmation = await deps.confirmTurn(
        screenInput(conversation, flag.index),
        policyQuestion(flag.policy)
      );
      if (!confirmation.answer) continue;
      failed.add(flag.policy.id);
      verdicts.push({
        policyId: flag.policy.id,
        pass: false,
        turnId: flag.turn.id,
        evidence: flag.turn.content,
        reason: confirmation.reason
      });
    }

    if (flags.length > 0 && unscreened.length > 0 && deps.conversationJudge) {
      if (deps.stats) deps.stats.conversationJudgeCalls += 1;
      verdicts.push(
        ...(await deps.conversationJudge(conversation, { name: agent.name, policies: unscreened }))
      );
    }
    return verdicts;
  };
}
