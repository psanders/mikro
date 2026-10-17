/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Rubric checks for eval turns (openspec decision-judges): each turn may list
 * closed yes/no questions about the agent's reply ("¿Afirma que la solicitud
 * está en revisión?") with the expected answer. The decision model answers
 * them first; an answer it is unsure of goes to the LLM judge, which also
 * writes the reason for every failure. Replaces "is it similar to the
 * expected reply?", which passed invented facts and failed correct wording.
 */
import { verdictOf, type DecisionProvider, type DecisionResult } from "../decisions/index.js";
import { createCheckLlmJudge, type CheckLlmJudge } from "../decisions/llmCheck.js";
import { logger } from "../logger.js";

export { createCheckLlmJudge, type CheckLlmJudge };

/** At or above this certainty the decision model's failing answer stands even if the LLM disagrees. */
export const DISPUTE_CEILING = 0.9;

export interface EvalCheck {
  id: string;
  /** A Spanish yes/no question about the agent's reply. */
  question: string;
  /** The answer a correct reply gives. */
  expect: boolean;
}

export interface CheckResult {
  id: string;
  question: string;
  expect: boolean;
  /** The answer used for the verdict. */
  answer: boolean | null;
  passed: boolean;
  /** Who answered: the decision model, or the LLM judge after an unsure answer. */
  decidedBy: "decision" | "llm";
  /** The decision model's probability that the answer is yes. */
  probability: number | null;
  /** The LLM judge's reason (unsure answers and failures only). */
  reason?: string;
  /** The LLM disagreed with a failing decision answer (it wins below DISPUTE_CEILING). */
  llmDisagrees?: boolean;
}

export interface CheckRunStats {
  decisionCalls: number;
  decisionInputTokens: number;
  decisionLatencyMs: number;
  llmCalls: number;
}

export interface TurnTranscript {
  /** Earlier turns, oldest first. */
  history: Array<{ role: "user" | "assistant"; content: string }>;
  human: string;
  reply: string;
  tools: Array<{ name: string; args?: Record<string, unknown> }>;
}

/** What both judges read: the conversation so far, the message, the reply and its tools. */
export function checkInput(t: TurnTranscript): string {
  const lines = t.history
    .slice(-8)
    .map((m) => `${m.role === "user" ? "PERSONA" : "AGENTE"}: ${m.content || "(sin texto)"}`);
  const tools = t.tools.length
    ? t.tools.map((x) => `${x.name}(${JSON.stringify(x.args ?? {})})`).join(", ")
    : "ninguna";
  return [
    lines.length ? `CONVERSACIÓN PREVIA:\n${lines.join("\n")}` : "CONVERSACIÓN PREVIA: (ninguna)",
    `MENSAJE DE LA PERSONA: ${t.human || "(sin texto)"}`,
    `RESPUESTA DEL AGENTE: ${t.reply || "(sin texto)"}`,
    `HERRAMIENTAS QUE EJECUTÓ EL AGENTE: ${tools}`
  ].join("\n\n");
}

/**
 * Answer a turn's checks: one decision request for all of them, the LLM for
 * unsure answers and to explain failures.
 */
export async function runChecks(
  checks: EvalCheck[],
  transcript: TurnTranscript,
  deps: { decisions: DecisionProvider; llm: CheckLlmJudge; threshold?: number },
  stats?: CheckRunStats
): Promise<CheckResult[]> {
  if (checks.length === 0) return [];
  const input = checkInput(transcript);
  // The decision model failing (timeout, outage) leaves every check unsure, so
  // the LLM answers them instead of one failed request aborting the whole run.
  const result: DecisionResult = await deps.decisions
    .ask(
      input,
      checks.map((c) => ({ type: "predicate", name: c.id, instructions: c.question }))
    )
    .catch((error: Error) => {
      logger.warn("decision model failed; the LLM answers this turn's checks", {
        error: error.message
      });
      return {
        answers: [],
        model: deps.decisions.id,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0
      };
    });
  if (stats) {
    stats.decisionCalls += 1;
    stats.decisionInputTokens += result.inputTokens;
    stats.decisionLatencyMs += result.latencyMs;
  }

  return Promise.all(
    checks.map(async (check): Promise<CheckResult> => {
      const answer = result.answers.find((a) => a.name === check.id);
      const probability = answer?.type === "predicate" ? answer.probability : null;
      const verdict = verdictOf(answer, deps.threshold);
      if (verdict === "unsure") {
        if (stats) stats.llmCalls += 1;
        const llm = await deps.llm(input, check.question);
        return {
          ...check,
          answer: llm.answer,
          passed: llm.answer === check.expect,
          decidedBy: "llm",
          probability,
          reason: llm.reason
        };
      }
      const yes = verdict === "yes";
      const passed = yes === check.expect;
      if (passed) {
        return { ...check, answer: yes, passed, decidedBy: "decision", probability };
      }
      // A failure gets a second opinion: the LLM writes the reason, and below
      // DISPUTE_CEILING its disagreement wins. Experiment 2026-10-16: the
      // decision model misread "No tengo acceso a los datos de otras personas"
      // at p = 0.8 (the LLM was right), while at p ≥ 0.9 it was right every
      // time and the LLM once overruled a correct p = 1.0 answer.
      if (stats) stats.llmCalls += 1;
      const llm = await deps.llm(input, check.question);
      const certainty = probability === null ? 0 : Math.max(probability, 1 - probability);
      if (llm.answer !== yes && certainty < DISPUTE_CEILING) {
        return {
          ...check,
          answer: llm.answer,
          passed: llm.answer === check.expect,
          decidedBy: "llm",
          probability,
          reason: llm.reason,
          llmDisagrees: true
        };
      }
      return {
        ...check,
        answer: yes,
        passed,
        decidedBy: "decision",
        probability,
        reason: llm.reason,
        ...(llm.answer !== yes ? { llmDisagrees: true } : {})
      };
    })
  );
}
