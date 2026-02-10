/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

/**
 * Supported LLM vendors.
 */
export const LLM_VENDORS = ["openai", "anthropic", "google"] as const;
export type LLMVendor = (typeof LLM_VENDORS)[number];

/**
 * LLM purposes in the application.
 */
export const LLM_PURPOSES = ["text", "vision", "evals"] as const;
export type LLMPurpose = (typeof LLM_PURPOSES)[number];

/**
 * Zod schema for LLM configuration JSON.
 */
export const llmConfigSchema = z.object({
  vendor: z.enum(LLM_VENDORS),
  apiKey: z.string().min(1, "API key is required"),
  model: z.string().min(1, "Model name is required")
});

export type LLMConfig = z.infer<typeof llmConfigSchema>;

/**
 * Model registry per vendor.
 * Lists all supported models and which ones support vision.
 */
const MODEL_REGISTRY: Record<LLMVendor, { models: string[]; visionModels: string[] }> = {
  openai: {
    models: ["gpt-5.2", "gpt-5-mini", "gpt-4.1"],
    visionModels: ["gpt-5.2", "gpt-5-mini", "gpt-4.1"]
  },
  anthropic: {
    models: [
      "claude-opus-4-6",
      "claude-sonnet-4-5-20250929",
      "claude-sonnet-4-20250514",
      "claude-haiku-4-5-20251001"
    ],
    visionModels: [
      "claude-opus-4-6",
      "claude-sonnet-4-5-20250929",
      "claude-sonnet-4-20250514",
      "claude-haiku-4-5-20251001"
    ]
  },
  google: {
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
    visionModels: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"]
  }
};

/**
 * Default configurations per purpose.
 * Used when environment variable is not set.
 */
export const DEFAULT_CONFIGS: Record<LLMPurpose, Omit<LLMConfig, "apiKey">> = {
  text: { vendor: "openai", model: "gpt-5-mini" },
  vision: { vendor: "openai", model: "gpt-5.2" },
  evals: { vendor: "openai", model: "gpt-5-mini" }
};

/**
 * Get all supported models for a vendor.
 */
export function getModelsForVendor(vendor: LLMVendor): string[] {
  return MODEL_REGISTRY[vendor].models;
}

/**
 * Get all vision-capable models for a vendor.
 */
export function getVisionModelsForVendor(vendor: LLMVendor): string[] {
  return MODEL_REGISTRY[vendor].visionModels;
}

/**
 * Check if a model supports vision for the given vendor.
 */
export function isVisionModel(vendor: LLMVendor, model: string): boolean {
  return MODEL_REGISTRY[vendor].visionModels.includes(model);
}

/**
 * Validate that a model is valid for the given vendor.
 * @throws Error if model is not valid for vendor
 */
export function validateModelForVendor(
  config: LLMConfig,
  options?: { requireVision?: boolean }
): void {
  const { vendor, model } = config;
  const registry = MODEL_REGISTRY[vendor as LLMVendor];

  if (!registry.models.includes(model)) {
    throw new Error(
      `Invalid model "${model}" for vendor "${vendor}". ` +
        `Valid models are: ${registry.models.join(", ")}`
    );
  }

  if (options?.requireVision && !registry.visionModels.includes(model)) {
    throw new Error(
      `Model "${model}" does not support vision for vendor "${vendor}". ` +
        `Vision-capable models are: ${registry.visionModels.join(", ")}`
    );
  }
}

/**
 * Parse and validate LLM configuration from JSON string.
 * @param purpose - The LLM purpose (for error messages)
 * @param jsonString - JSON string to parse
 * @returns Validated LLM configuration
 * @throws Error if JSON is invalid or config doesn't pass validation
 */
export function parseLLMConfig(purpose: LLMPurpose, jsonString: string): LLMConfig {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error(`Invalid JSON for MIKRO_LLM_${purpose.toUpperCase()}: ${jsonString}`);
  }

  const result = llmConfigSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
    throw new Error(`Invalid config for MIKRO_LLM_${purpose.toUpperCase()}: ${errors}`);
  }

  // Validate model is valid for vendor
  validateModelForVendor(result.data);

  return result.data;
}

/**
 * Create a LangChain chat model based on configuration.
 * @param config - LLM configuration with vendor, apiKey, and model
 * @param options - Additional options for the model
 * @returns LangChain BaseChatModel instance
 */
export function createChatModel(
  config: LLMConfig,
  options?: { temperature?: number }
): BaseChatModel {
  const { vendor, apiKey, model } = config;
  const temperature = options?.temperature ?? 0.7;

  switch (vendor) {
    case "openai":
      return new ChatOpenAI({
        apiKey,
        model,
        temperature,
        // Use maxCompletionTokens so newer models (gpt-5.x) get the correct API parameter
        // instead of deprecated max_tokens which they reject
        maxCompletionTokens: 4096
      });

    case "anthropic":
      return new ChatAnthropic({
        apiKey,
        model,
        temperature
      });

    case "google":
      return new ChatGoogleGenerativeAI({
        apiKey,
        model,
        temperature
      });

    default:
      throw new Error(`Unknown vendor: ${vendor}`);
  }
}
