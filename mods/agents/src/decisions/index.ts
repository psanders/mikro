/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Decision-model layer (openspec conversation-state): one interface for the
 * CX classifier and the eval checks.
 */
import {
  getCxClassifierConfig,
  getEvalsClassifierConfig,
  type ClassifierConfig
} from "@mikro/common";
import { createOpenAIDecisionsProvider } from "./openaiDecisions.js";
import { createChatDecisionProvider } from "./chatDecisions.js";
import type { DecisionProvider } from "./types.js";

export * from "./types.js";
export { createOpenAIDecisionsProvider } from "./openaiDecisions.js";
export { createChatDecisionProvider } from "./chatDecisions.js";
export * from "./verdict.js";
export * from "./classifier.js";
export { createCheckLlmJudge, type CheckLlmJudge } from "./llmCheck.js";

/** A provider from a classifier config (`cx.classifier` or `evals.classifier`). */
export function createDecisionProvider(config: ClassifierConfig): DecisionProvider {
  return config.provider === "openai-decisions"
    ? createOpenAIDecisionsProvider({ apiKey: config.apiKey, model: config.model })
    : createChatDecisionProvider({
        vendor: config.vendor,
        apiKey: config.apiKey,
        model: config.model
      });
}

/** The provider that labels inbound CX turns, or null without `cx.classifier` (labels off). */
export function getCxDecisionProvider(): DecisionProvider | null {
  const config = getCxClassifierConfig();
  return config ? createDecisionProvider(config) : null;
}

/** The provider that answers eval checks, or null without `evals.classifier`. */
export function getEvalsDecisionProvider(): DecisionProvider | null {
  const config = getEvalsClassifierConfig();
  return config ? createDecisionProvider(config) : null;
}
