/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { getConfig, clearConfigCache, LOAN_APPLICATION_PROMO_ASSET_ROUTE } from "@mikro/common";
import { type LLMConfig, type LLMPurpose, validateModelForVendor } from "./llm/providers.js";

/** LLM purposes required at apiserver/agents startup. Evals is only required when running evals. */
const LLM_PURPOSES_REQUIRED_AT_STARTUP: readonly LLMPurpose[] = ["text", "vision"];

/**
 * Get LLM configuration for a specific purpose from mikro.json.
 *
 * @param purpose - The LLM purpose (text, vision, evals)
 * @returns The validated LLM configuration
 */
export function getLLMConfig(purpose: LLMPurpose): LLMConfig {
  const config = getConfig().llm[purpose];
  return config;
}

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
 * Clear the config cache (including LLM config). Useful for testing.
 */
export function clearLLMConfigCache(): void {
  clearConfigCache();
}

// Re-export types and utilities for convenience
export type { LLMConfig, LLMPurpose };

/**
 * Get WhatsApp webhook verify token from config.
 */
export function getWebhookVerifyToken(): string {
  return getConfig().whatsapp.verifyToken;
}

/**
 * Get WhatsApp Phone Number ID from config.
 */
export function getWhatsAppPhoneNumberId(): string {
  return getConfig().whatsapp.phoneNumberId;
}

/**
 * Get WhatsApp Access Token from config.
 */
export function getWhatsAppAccessToken(): string {
  return getConfig().whatsapp.accessToken;
}

/**
 * Promo template config: the approved Flow template (CTA opens the intake Flow)
 * sent when a reviewer opts in on manual application creation, plus the language
 * code to send it under (the shared WhatsApp language).
 */
export function getWhatsAppPromoTemplate(): {
  templateName: string;
  languageCode: string;
  imageUrl: string;
} {
  const cfg = getConfig();
  const { templates, languageCode } = cfg.whatsapp;
  // The template's IMAGE header is a per-send parameter. Default to the banner
  // the API server serves (publicUrl + asset route); an explicit config URL wins.
  const publicBase = cfg.publicUrl.replace(/\/+$/, "");
  return {
    templateName: templates.loanApplicationPromo,
    languageCode,
    imageUrl:
      templates.loanApplicationPromoImageUrl || `${publicBase}${LOAN_APPLICATION_PROMO_ASSET_ROUTE}`
  };
}

/**
 * Get the path for storing receipt images.
 */
export function getReceiptsPath(): string {
  return getConfig().receiptsPath;
}

/**
 * Get the public URL for the API server.
 */
export function getPublicUrl(): string {
  return getConfig().publicUrl;
}

/**
 * Get the maximum message age in seconds.
 */
export function getMessageMaxAgeSeconds(): number {
  return getConfig().messageMaxAgeSeconds;
}

/**
 * Get session timeout in seconds.
 */
export function getSessionTimeoutSeconds(): number {
  return getConfig().sessionTimeoutSeconds;
}

/**
 * Whether voice notes (audio messages) are enabled.
 */
export function getVoiceNotesEnabled(): boolean {
  return getConfig().voiceNotes.enabled;
}

/**
 * Get the Deepgram API key for voice note transcription.
 */
export function getDeepgramApiKey(): string | undefined {
  const key = getConfig().voiceNotes.deepgramApiKey;
  return key && key.trim().length > 0 ? key.trim() : undefined;
}

/**
 * Get the similarity confidence threshold for eval judge (0-1).
 */
export function getEvalSimilarityThreshold(): number {
  return getConfig().evals.similarityThreshold;
}
