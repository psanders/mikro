/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Decision models (openspec conversation-state): models that answer typed
 * questions with probabilities instead of writing text. The shapes mirror
 * OpenAI's Decisions API (`POST /v1/decisions`), so that adapter is a thin
 * pass-through and the chat adapter imitates it.
 */

/** A yes/no question: answered with the probability that it is true. */
export interface PredicateQuestion {
  type: "predicate";
  /** Unique within one request; the answer echoes it. */
  name: string;
  instructions: string;
}

/** One of a fixed set of options. */
export interface ChoiceQuestion {
  type: "choice";
  name: string;
  instructions: string;
  choices: Array<{ value: string; description: string }>;
}

export type DecisionQuestion = PredicateQuestion | ChoiceQuestion;

export interface PredicateAnswer {
  type: "predicate";
  name: string;
  /** Probability (0–1) that the statement is true. */
  probability: number;
}

export interface ChoiceAnswer {
  type: "choice";
  name: string;
  choice: string;
  probabilities: Array<{ value: string; probability: number }>;
  /** How sure the model is of `choice` (0–1). */
  confidence: number;
}

/** The model declined to answer this question. */
export interface RefusalAnswer {
  type: "refusal";
  name: string;
}

export type DecisionAnswer = PredicateAnswer | ChoiceAnswer | RefusalAnswer;

export interface DecisionResult {
  answers: DecisionAnswer[];
  /** Provider and model that answered, e.g. `openai-decisions:gpt-6-luna`. */
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

/** Answers typed questions about one shared input. */
export interface DecisionProvider {
  /** `provider:model`, recorded with every label so results stay comparable. */
  readonly id: string;
  ask(input: string, questions: DecisionQuestion[]): Promise<DecisionResult>;
}
