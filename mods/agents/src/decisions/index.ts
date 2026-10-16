/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Decision-model layer (openspec conversation-state): one interface for the
 * CX classifier and the eval checks.
 */
import { getClassifierConfig, type ClassifierConfig } from "@mikro/common";
import { createOpenAIDecisionsProvider } from "./openaiDecisions.js";
import { createChatDecisionProvider } from "./chatDecisions.js";
import type { DecisionProvider } from "./types.js";

export * from "./types.js";
export { createOpenAIDecisionsProvider } from "./openaiDecisions.js";
export { createChatDecisionProvider } from "./chatDecisions.js";
export * from "./verdict.js";
export * from "./classifier.js";
export { createCheckLlmJudge, type CheckLlmJudge } from "./llmCheck.js";

/** A provider from a `classifier` config section. */
export function createDecisionProvider(config: ClassifierConfig): DecisionProvider {
  return config.provider === "openai-decisions"
    ? createOpenAIDecisionsProvider({ apiKey: config.apiKey, model: config.model })
    : createChatDecisionProvider({
        vendor: config.vendor,
        apiKey: config.apiKey,
        model: config.model
      });
}

/** The configured provider, or null when `classifier` is absent (feature off). */
export function getDecisionProvider(): DecisionProvider | null {
  const config = getClassifierConfig();
  return config ? createDecisionProvider(config) : null;
}
