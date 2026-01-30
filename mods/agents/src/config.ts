/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

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
 * Get OpenAI API key from environment.
 * @returns The OpenAI API key
 * @throws Error if not set
 */
export function getOpenAIApiKey(): string {
  return validateRequired(process.env.MIKRO_OPENAI_API_KEY, "MIKRO_OPENAI_API_KEY");
}

/**
 * Get model for text-only requests.
 * @returns The model name, defaults to 'gpt-4o-mini'
 */
export function getTextModel(): string {
  return process.env.MIKRO_TEXT_MODEL || "gpt-4o-mini";
}

/**
 * Get model for requests with images.
 * @returns The model name, defaults to 'gpt-4o'
 */
export function getVisionModel(): string {
  return process.env.MIKRO_VISION_MODEL || "gpt-4o";
}

/**
 * Get model for similarity/response judging.
 * @returns The model name, defaults to 'gpt-4o-mini'
 */
export function getJudgeModel(): string {
  return process.env.MIKRO_JUDGE_MODEL || "gpt-4o-mini";
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
