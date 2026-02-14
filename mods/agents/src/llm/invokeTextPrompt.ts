/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Single-turn text prompt invocation (no tools, no history).
 * Used for report narrative generation and other one-shot LLM calls.
 */
import { HumanMessage } from "@langchain/core/messages";
import { getLLMConfig } from "../config.js";
import { createChatModel } from "./providers.js";

/**
 * Invoke the text LLM with a single prompt and return the response content as string.
 *
 * @param prompt - The user prompt
 * @returns The model's text response
 */
export async function invokeTextPrompt(prompt: string): Promise<string> {
  const config = getLLMConfig("text");
  const model = createChatModel(config, { temperature: 0.4 });
  const response = await model.invoke([new HumanMessage(prompt)]);
  return typeof response.content === "string" ? response.content : "";
}
