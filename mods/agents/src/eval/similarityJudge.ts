/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import OpenAI from "openai";
import { getOpenAIApiKey, getJudgeModel } from "../config.js";

const CONFIDENCE_THRESHOLD = 0.7;

// Singleton OpenAI client
let openaiClient: OpenAI | null = null;

/**
 * Get or create OpenAI client instance.
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = getOpenAIApiKey();
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

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
 * Test if two responses are semantically similar using LLM judge.
 *
 * @param expected - The expected response
 * @param actual - The actual response from the agent
 * @returns Similarity result with confidence and reason
 */
export async function similarityTest(expected: string, actual: string): Promise<SimilarityResult> {
  const client = getOpenAIClient();

  const systemPrompt = `You are an evaluation judge for AI agent responses. Your task is to determine if two responses are semantically equivalent, meaning they convey the same meaning and intent, even if the wording differs.

Consider:
- Do both responses answer the same question or address the same point?
- Do they have the same tone and style?
- Are key information points present in both?
- Minor wording differences are acceptable if the meaning is the same

Respond with a JSON object containing:
- "similar": boolean (true if semantically equivalent)
- "confidence": number between 0 and 1 (how confident you are)
- "reason": string (brief explanation of your decision)`;

  const userPrompt = `Expected response:
${expected}

Actual response:
${actual}

Are these responses semantically equivalent?`;

  try {
    const response = await client.chat.completions.create({
      model: getJudgeModel(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1 // Low temperature for consistent judging
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Judge returned empty response");
    }

    const result = JSON.parse(content) as {
      similar: boolean;
      confidence: number;
      reason: string;
    };

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
  const client = getOpenAIClient();

  const systemPrompt = `You are an evaluation judge for function arguments. Your task is to determine if the EXPECTED arguments are present and match in the ACTUAL arguments.

IMPORTANT RULES:
1. ONLY check if expected keys exist in actual with matching values
2. IGNORE any extra keys in actual that are not in expected - they DO NOT affect the result
3. For person names: names with the same words in different order ARE equivalent (e.g., "Pedro Santiago Sanders Almonte" = "Sanders Almonte Pedro Santiago" = "Pedro Sanders Almonte")
4. Values are semantically equivalent if they represent the same thing (e.g., "Isaic" matches "Isaac", "REFERRER" matches "referrer")

Respond with a JSON object containing:
- "match": boolean (true if ALL expected keys are present in actual with matching values)
- "reason": string (brief explanation)`;

  const userPrompt = `Expected arguments:
${JSON.stringify(expected, null, 2)}

Actual arguments:
${JSON.stringify(actual, null, 2)}

Are these arguments semantically equivalent?`;

  try {
    const response = await client.chat.completions.create({
      model: getJudgeModel(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Judge returned empty response");
    }

    const result = JSON.parse(content) as {
      match: boolean;
      reason: string;
    };

    return {
      match: result.match,
      reason: result.reason || "No reason provided"
    };
  } catch (error) {
    const err = error as Error;
    throw new Error(`Argument comparison failed: ${err.message}`);
  }
}
