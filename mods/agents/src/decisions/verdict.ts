/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Turning decision answers into verdicts, plus cost estimates.
 */
import type { DecisionAnswer, DecisionResult } from "./types.js";

/**
 * Below this, an answer is "unsure": it never triggers an action on its own
 * and, in evals and the audit, is escalated to the LLM judge. Starting value
 * from the research (decision models are as accurate as GPT-class judges at
 * ≥ 0.9); to be re-tuned on our labeled Spanish turns.
 */
export const DECISION_MIN_CONFIDENCE = 0.7;

export type Verdict = "yes" | "no" | "unsure";

/** A predicate's answer as yes / no / unsure at `threshold` (refusals are unsure). */
export function verdictOf(
  answer: DecisionAnswer | undefined,
  threshold = DECISION_MIN_CONFIDENCE
): Verdict {
  if (!answer || answer.type !== "predicate") return "unsure";
  if (answer.probability >= threshold) return "yes";
  if (answer.probability <= 1 - threshold) return "no";
  return "unsure";
}

/** Find one answer by question name. */
export function answerOf(result: DecisionResult, name: string): DecisionAnswer | undefined {
  return result.answers.find((a) => a.name === name);
}

/** USD list price per 1M tokens, for experiment and audit cost reporting. */
const PRICES: Record<string, { input: number; output: number }> = {
  "openai-decisions:gpt-6-luna": { input: 0.1, output: 0 },
  "chat:openai:gpt-4o-mini": { input: 0.15, output: 0.6 },
  "chat:openai:gpt-4o": { input: 2.5, output: 10 },
  "chat:google:gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "chat:anthropic:claude-haiku-4-5-20251001": { input: 1, output: 5 }
};

/** Estimated cost in USD of one result, or null for an unpriced model. */
export function costOf(result: Pick<DecisionResult, "model" | "inputTokens" | "outputTokens">) {
  const price = PRICES[result.model];
  if (!price) return null;
  return (result.inputTokens * price.input + result.outputTokens * price.output) / 1_000_000;
}
