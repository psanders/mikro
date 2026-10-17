/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Single-turn text prompt invocation (no tools, no history).
 * Used for report narrative generation and other one-shot LLM calls.
 */
import { HumanMessage } from "@langchain/core/messages";
import { createChatModel, type LLMConfig } from "./providers.js";

/**
 * Invoke a model with a single prompt and return the response content as string.
 *
 * @param config - The model (the calling feature's, e.g. `reports.model`)
 * @param prompt - The user prompt
 * @returns The model's text response
 */
export async function invokeTextPrompt(config: LLMConfig, prompt: string): Promise<string> {
  const model = createChatModel(config, { temperature: 0.4 });
  const response = await model.invoke([new HumanMessage(prompt)]);
  return typeof response.content === "string" ? response.content : "";
}
