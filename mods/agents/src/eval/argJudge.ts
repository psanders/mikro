/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getLLMConfig } from "../config.js";
import { createChatModel } from "../llm/providers.js";

/**
 * Schema for argument comparison response.
 */
const argCompareResponseSchema = z.object({
  match: z.boolean().describe("Whether all expected keys are present with matching values"),
  reason: z.string().describe("Brief explanation")
});

/**
 * Compare two argument objects semantically using LLM judge.
 * Used when matchMode is "judge".
 *
 * @param expected - Expected arguments
 * @param actual - Actual arguments
 * @returns Whether arguments are semantically equivalent
 */
export async function compareArgs(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>
): Promise<{ match: boolean; reason: string }> {
  const config = getLLMConfig("evals");
  const model = createChatModel(config, { temperature: 0.1 });

  // Use structured output for type-safe responses
  const structuredModel = model.withStructuredOutput(argCompareResponseSchema);

  const systemPrompt = `You are an evaluation judge for function arguments. Your task is to determine if the EXPECTED arguments are present and match in the ACTUAL arguments.

IMPORTANT RULES:
1. ONLY check if expected keys exist in actual with matching values
2. IGNORE any extra keys in actual that are not in expected - they DO NOT affect the result
3. For person names: names with the same words in different order ARE equivalent (e.g., "Juan Carlos Pérez García" = "Pérez García Juan Carlos" = "Juan Pérez García")
4. Values are semantically equivalent if they represent the same thing (e.g., "Isaic" matches "Isaac", "COLLECTOR" matches "collector")`;

  const userPrompt = `Expected arguments:
${JSON.stringify(expected, null, 2)}

Actual arguments:
${JSON.stringify(actual, null, 2)}

Are these arguments semantically equivalent?`;

  try {
    const result = await structuredModel.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ]);

    return {
      match: result.match,
      reason: result.reason || "No reason provided"
    };
  } catch (error) {
    const err = error as Error;
    throw new Error(`Argument comparison failed: ${err.message}`);
  }
}
