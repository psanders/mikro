/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { getConfig, clearConfigCache, LOAN_APPLICATION_PROMO_ASSET_ROUTE } from "@mikro/common";
import { type LLMConfig, validateModelForVendor } from "./llm/providers.js";

/** The WhatsApp agents' model (`cx.model`). */
export function getCxModel(): LLMConfig {
  return getConfig().cx.model;
}

/** The WhatsApp agents' model for turns with photos (`cx.visionModel`). */
export function getCxVisionModel(): LLMConfig {
  return getConfig().cx.visionModel;
}

/** The founder copilot's model (`copilot.model`). */
export function getCopilotModel(): LLMConfig {
  return getConfig().copilot.model;
}

/** The application summary's model (`applications.summaryModel`). */
export function getApplicationSummaryModel(): LLMConfig {
  return getConfig().applications.summaryModel;
}

/** The report narratives' model (`reports.model`). */
export function getReportsModel(): LLMConfig {
  return getConfig().reports.model;
}

/** Throws a clear error naming the missing key of an optional feature. */
function required(config: LLMConfig | undefined, key: string): LLMConfig {
  if (!config) throw new Error(`${key} is not configured in mikro.json`);
  return config;
}

/** The feedback button's model (`githubFeedback.model`, required once its token is set). */
export function getFeedbackModel(): LLMConfig {
  return required(getConfig().githubFeedback.model, "githubFeedback.model");
}

/** The conversation audit's judge model (`conversationAudit.model`). */
export function getAuditModel(): LLMConfig {
  return required(getConfig().conversationAudit.model, "conversationAudit.model");
}

/** The evals' LLM judge (`evals.model`): unsure checks, failure reasons, tool arguments. */
export function getEvalsModel(): LLMConfig {
  return required(getConfig().evals.model, "evals.model");
}

/**
 * Validate the models of the always-on features at startup, to fail fast on
 * misconfiguration: `cx.visionModel` must support images.
 *
 * @throws Error if a model is invalid
 */
export function validateAllLLMConfigs(): void {
  try {
    validateModelForVendor(getCxVisionModel(), { requireVision: true });
  } catch (error) {
    throw new Error(`LLM configuration error: cx.visionModel: ${(error as Error).message}`);
  }
}

/**
 * Clear the config cache (including LLM config). Useful for testing.
 */
export function clearLLMConfigCache(): void {
  clearConfigCache();
}

export type { LLMConfig };

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
 * Whether the webhook may reply to inbound WhatsApp messages at all (LLM
 * agents and the deterministic fallbacks alike). False makes the number go
 * quiet; outbound templates, the Chatwoot mirror and delivery statuses are
 * unaffected, and intake Flow submissions are still ingested.
 */
export function getWhatsAppAgentRepliesEnabled(): boolean {
  return getConfig().whatsapp.agentRepliesEnabled;
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
