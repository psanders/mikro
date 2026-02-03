/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  type LLMConfig,
  type LLMPurpose,
  DEFAULT_CONFIGS,
  parseLLMConfig,
  validateModelForVendor
} from "./llm/providers.js";

/**
 * Validate that a string environment variable is set and non-empty.
 * @param value - The environment variable value
 * @param fieldName - The field name for error messages
 * @returns The validated string
 * @throws Error if the value is not set or empty
 */
function validateRequired(value: string | undefined, fieldName: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`${fieldName} environment variable is not set or invalid`);
  }
  return value;
}

// Cache for parsed LLM configs
const llmConfigCache = new Map<LLMPurpose, LLMConfig>();

/**
 * Get LLM configuration for a specific purpose.
 * Parses the JSON environment variable and validates vendor/model combination.
 *
 * @param purpose - The LLM purpose (general, vision, evals)
 * @returns The validated LLM configuration
 * @throws Error if env var is missing or config is invalid
 *
 * @example
 * // MIKRO_LLM_GENERAL='{"vendor":"openai","apiKey":"sk-...","model":"gpt-4o-mini"}'
 * getLLMConfig("general") → { vendor: "openai", apiKey: "sk-...", model: "gpt-4o-mini" }
 */
export function getLLMConfig(purpose: LLMPurpose): LLMConfig {
  // Return cached config if available
  const cached = llmConfigCache.get(purpose);
  if (cached) {
    return cached;
  }

  const envVarName = `MIKRO_LLM_${purpose.toUpperCase()}`;
  const envValue = process.env[envVarName];

  if (!envValue || envValue.trim().length === 0) {
    throw new Error(
      `${envVarName} environment variable is not set. ` +
        `Expected JSON: {"vendor":"openai|anthropic|google","apiKey":"...","model":"..."}`
    );
  }

  const config = parseLLMConfig(purpose, envValue);

  // Cache the config
  llmConfigCache.set(purpose, config);

  return config;
}

/** LLM purposes required at apiserver/agents startup. Evals is only required when running evals. */
const LLM_PURPOSES_REQUIRED_AT_STARTUP: readonly LLMPurpose[] = ["text", "vision"];

/**
 * Validate LLM configurations required at startup (text, vision).
 * Evals config is only validated when evals are run.
 * Should be called during application initialization to fail fast on misconfiguration.
 *
 * @throws Error if any required LLM configuration is invalid
 */
export function validateAllLLMConfigs(): void {
  const errors: string[] = [];

  for (const purpose of LLM_PURPOSES_REQUIRED_AT_STARTUP) {
    try {
      const config = getLLMConfig(purpose);

      // Additional validation for vision purpose - must support vision
      if (purpose === "vision") {
        validateModelForVendor(config, { requireVision: true });
      }
    } catch (error) {
      errors.push(`${purpose}: ${(error as Error).message}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`LLM configuration errors:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }
}

/**
 * Clear the LLM config cache.
 * Useful for testing or when env vars change at runtime.
 */
export function clearLLMConfigCache(): void {
  llmConfigCache.clear();
}

// Re-export types and utilities for convenience
export type { LLMConfig, LLMPurpose };
export { DEFAULT_CONFIGS };

/**
 * Get WhatsApp webhook verify token from environment.
 * @returns The verify token, defaults to 'mikro_webhook_token'
 */
export function getWebhookVerifyToken(): string {
  const token = process.env.MIKRO_WHATSAPP_VERIFY_TOKEN;

  if (!token || token.trim().length === 0) {
    return "mikro_webhook_token"; // Default value
  }

  return token;
}

/**
 * Get WhatsApp Phone Number ID from environment.
 * @returns The phone number ID
 * @throws Error if not set
 */
export function getWhatsAppPhoneNumberId(): string {
  return validateRequired(
    process.env.MIKRO_WHATSAPP_PHONE_NUMBER_ID,
    "MIKRO_WHATSAPP_PHONE_NUMBER_ID"
  );
}

/**
 * Get WhatsApp Access Token from environment.
 * @returns The access token
 * @throws Error if not set
 */
export function getWhatsAppAccessToken(): string {
  return validateRequired(process.env.MIKRO_WHATSAPP_ACCESS_TOKEN, "MIKRO_WHATSAPP_ACCESS_TOKEN");
}

/**
 * Get the public path for storing/serving static files.
 * @returns The public path, defaults to './public'
 */
export function getPublicPath(): string {
  return process.env.MIKRO_PUBLIC_PATH || "./public";
}

/**
 * Get the public URL for the API server.
 * @returns The public URL, defaults to 'http://localhost:3000'
 */
export function getPublicUrl(): string {
  return process.env.MIKRO_PUBLIC_URL || `http://localhost:${process.env.MIKRO_PORT || 3000}`;
}

/**
 * Build a public URL for an image file.
 * @param filename - The image filename
 * @returns The full public URL to the image
 * @example
 * getPublicImageUrl("10000.png") → "https://api.mikro.com/images/10000.png"
 */
export function getPublicImageUrl(filename: string): string {
  const publicUrl = getPublicUrl();
  return `${publicUrl}/images/${filename}`;
}

/**
 * Get the maximum message age in seconds.
 * Messages older than this will be discarded.
 * @returns Max age in seconds (default: 60)
 */
export function getMessageMaxAgeSeconds(): number {
  const value = process.env.MIKRO_MESSAGE_MAX_AGE_SECONDS;
  return value ? parseInt(value, 10) : 60;
}

/**
 * Get session timeout in seconds.
 * If the last message was older than this, the next message starts a new session (full greeting).
 * @returns Timeout in seconds (default: 1800 = 30 minutes)
 */
export function getSessionTimeoutSeconds(): number {
  const value = process.env.MIKRO_SESSION_TIMEOUT_SECONDS;
  return value ? parseInt(value, 10) : 1800;
}

import { VALID_AGENT_NAMES, AGENT_NAMES, type AgentName } from "./constants.js";

/**
 * Get disabled agents from environment variable.
 * Reads MIKRO_DISABLED_AGENTS as a comma-separated list of agent names.
 * Validates that all agent names are valid.
 *
 * @returns A Set of disabled agent names, or empty Set if not set
 * @example
 * // MIKRO_DISABLED_AGENTS=joan,maria
 * getDisabledAgents() → Set(["joan", "maria"])
 */
export function getDisabledAgents(): Set<string> {
  const disabledAgentsEnv = process.env.MIKRO_DISABLED_AGENTS;

  if (!disabledAgentsEnv || disabledAgentsEnv.trim().length === 0) {
    return new Set<string>();
  }

  // Parse comma-separated list and trim whitespace
  const agentNames = disabledAgentsEnv
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length > 0);

  // Validate all agent names are valid
  const invalidNames = agentNames.filter(
    (name): name is string => !VALID_AGENT_NAMES.has(name as AgentName)
  );
  if (invalidNames.length > 0) {
    throw new Error(
      `Invalid agent names in MIKRO_DISABLED_AGENTS: ${invalidNames.join(", ")}. Valid names are: ${AGENT_NAMES.join(", ")}`
    );
  }

  return new Set(agentNames);
}
