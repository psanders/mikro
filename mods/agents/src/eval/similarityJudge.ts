/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getLLMConfig } from "../config.js";
import { createChatModel } from "../llm/providers.js";

const CONFIDENCE_THRESHOLD = 0.7;

/**
 * Result from similarity test.
 */
export interface SimilarityResult {
  /** Whether the responses are semantically similar */
  similar: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reason for the decision */
  reason: string;
}

/**
 * Schema for similarity test response.
 */
const similarityResponseSchema = z.object({
  similar: z.boolean().describe("Whether the responses are semantically equivalent"),
  confidence: z.number().min(0).max(1).describe("Confidence score between 0 and 1"),
  reason: z.string().describe("Brief explanation of the decision")
});

/**
 * Schema for argument comparison response.
 */
const argCompareResponseSchema = z.object({
  match: z.boolean().describe("Whether all expected keys are present with matching values"),
  reason: z.string().describe("Brief explanation")
});

/**
 * Test if two responses are semantically similar using LLM judge.
 *
 * @param expected - The expected response
 * @param actual - The actual response from the agent
 * @returns Similarity result with confidence and reason
 */
export async function similarityTest(expected: string, actual: string): Promise<SimilarityResult> {
  const config = getLLMConfig("evals");
  const model = createChatModel(config, { temperature: 0.1 });

  // Use structured output for type-safe responses
  const structuredModel = model.withStructuredOutput(similarityResponseSchema);

  const systemPrompt = `You are an evaluation judge for AI agent responses. Your task is to determine if two responses are semantically equivalent, meaning they convey the same meaning and intent, even if the wording differs.

Consider:
- Do both responses answer the same question or address the same point?
- Do they have the same tone and style?
- Are key information points present in both?
- Minor wording differences are acceptable if the meaning is the same`;

  const userPrompt = `Expected response:
${expected}

Actual response:
${actual}

Are these responses semantically equivalent?`;

  try {
    const result = await structuredModel.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ]);

    // Normalize confidence to 0-1 range
    const confidence = Math.max(0, Math.min(1, result.confidence));

    return {
      similar: result.similar && confidence >= CONFIDENCE_THRESHOLD,
      confidence,
      reason: result.reason || "No reason provided"
    };
  } catch (error) {
    const err = error as Error;
    throw new Error(`Similarity test failed: ${err.message}`);
  }
}

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
3. For person names: names with the same words in different order ARE equivalent (e.g., "Pedro Santiago Sanders Almonte" = "Sanders Almonte Pedro Santiago" = "Pedro Sanders Almonte")
4. Values are semantically equivalent if they represent the same thing (e.g., "Isaic" matches "Isaac", "REFERRER" matches "referrer")`;

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
