/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Deterministic WhatsApp handler for COLLECTOR-role users.
 *
 * Flow:
 *   1. Collector sends a business photo → vision LLM extracts first phone number
 *   2. If valid E.164 found → send reply-button confirmation + store pending
 *   3. Collector taps "Sí" → send intake Flow CTA promo to extracted number
 *   4. Collector taps "No" → cancel, no send
 *   5. Non-image / non-button → guidance reply
 */
import { phone as parsePhone } from "phone";
import type {
  SendWhatsAppMessageInput,
  SendWhatsAppTemplateInput,
  WhatsAppSendResponse
} from "@mikro/common";
import type { Agent, Message } from "../llm/types.js";
import type { InvokeLLMResult } from "../llm/createInvokeLLM.js";
import { getWhatsAppPromoTemplate } from "../config.js";
import { logger } from "../logger.js";

// ---------------------------------------------------------------------------
// Pending promo state (in-memory, 5-minute TTL)
// ---------------------------------------------------------------------------

interface PendingPromo {
  targetPhone: string;
  expiresAt: number;
}

const pendingPromos = new Map<string, PendingPromo>();
const PENDING_TTL_MS = 5 * 60 * 1000;

function getPending(collectorPhone: string): PendingPromo | undefined {
  const entry = pendingPromos.get(collectorPhone);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    pendingPromos.delete(collectorPhone);
    return undefined;
  }
  return entry;
}

function setPending(collectorPhone: string, targetPhone: string): void {
  pendingPromos.set(collectorPhone, { targetPhone, expiresAt: Date.now() + PENDING_TTL_MS });
}

function clearPending(collectorPhone: string): void {
  pendingPromos.delete(collectorPhone);
}

// ---------------------------------------------------------------------------
// Phone extraction helpers
// ---------------------------------------------------------------------------

/**
 * Try to convert a raw string from vision OCR into a valid E.164 number.
 * First attempts international parsing (handles numbers that already include
 * a country code). Falls back to Dominican Republic country hint for local
 * 10-digit numbers (area codes 809/829/849).
 */
function extractE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Try with leading + (covers full international format like 18095551234)
  const direct = parsePhone(`+${digits}`);
  if (direct.isValid) return direct.phoneNumber!;

  // Try with DR country hint (covers local 10-digit like 8095551234)
  const withDR = parsePhone(digits, { country: "DO" });
  if (withDR.isValid) return withDR.phoneNumber!;

  return null;
}

// ---------------------------------------------------------------------------
// Minimal inline agent for stateless vision phone extraction
// ---------------------------------------------------------------------------

const PHONE_EXTRACTOR_AGENT: Agent = {
  name: "phone-extractor",
  profile: "COLLECTOR",
  enabled: true,
  systemPrompt:
    "You are a phone number extractor. The user shows you an image of a business storefront or sign. " +
    "Extract the FIRST phone number you see. " +
    "Return ONLY the digits of that number — no dashes, spaces, parentheses, or any other characters. " +
    "If there are multiple numbers, return only the first one. " +
    "If there is no phone number visible in the image, return exactly: NONE",
  allowedTools: [],
  temperature: 0,
  replyMode: "final"
};

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

export interface CollectorMessageDeps {
  invokeLLM: (
    agent: Agent,
    messages: Message[],
    userMessage: string,
    imageUrl?: string | null,
    context?: Record<string, unknown>,
    isNewSession?: boolean
  ) => Promise<InvokeLLMResult>;
  sendWhatsAppMessage: (
    params: SendWhatsAppMessageInput
  ) => Promise<{ messages?: Array<{ id: string }> }>;
  sendTemplateMessage: (params: SendWhatsAppTemplateInput) => Promise<WhatsAppSendResponse>;
  /** Agent loaded from agents.yaml for COLLECTOR profile — falls back to inline constant if absent. */
  collectorAgent?: Agent;
  /**
   * Optional override for the promo template config — used in tests to avoid
   * reading from the runtime config. Production omits this and falls back to
   * `getWhatsAppPromoTemplate()`.
   */
  promoTemplate?: { templateName: string; languageCode: string; imageUrl: string };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

/**
 * Handle an inbound WhatsApp message from a COLLECTOR user.
 *
 * @param collectorPhone - Normalized E.164 phone of the collector
 * @param messageType    - WhatsApp message type ("image", "interactive", "text", …)
 * @param imageUrl       - Base64 data URL of the downloaded image (null when no image)
 * @param buttonReplyId  - `interactive.button_reply.id` from a button tap (undefined when not a button tap)
 * @param deps           - Injected dependencies
 */
export async function handleCollectorMessage(
  collectorPhone: string,
  messageType: string,
  imageUrl: string | null,
  buttonReplyId: string | undefined,
  deps: CollectorMessageDeps
): Promise<void> {
  const { invokeLLM, sendWhatsAppMessage, sendTemplateMessage } = deps;

  // ------------------------------------------------------------------
  // Branch 1: interactive button reply
  // ------------------------------------------------------------------
  if (messageType === "interactive" && buttonReplyId !== undefined) {
    const pending = getPending(collectorPhone);

    if (!pending) {
      logger.verbose("collector button reply with no pending promo", { collectorPhone });
      await sendWhatsAppMessage({
        phone: collectorPhone,
        message: "No hay ningún número pendiente. Envíame una foto del negocio para empezar."
      });
      return;
    }

    clearPending(collectorPhone);

    if (buttonReplyId === "yes") {
      try {
        const promo = deps.promoTemplate ?? getWhatsAppPromoTemplate();
        await sendTemplateMessage({
          phone: pending.targetPhone,
          templateName: promo.templateName,
          languageCode: promo.languageCode,
          headerParameters: [],
          bodyParameters: [],
          headerImageUrl: promo.imageUrl,
          // The intake Flow CTA template requires a flow token in the button
          // component. For collector-triggered sends there is no existing
          // application to correlate with, so we generate a unique opaque token.
          flowToken: crypto.randomUUID()
        });
        logger.info("collector promo sent", { collectorPhone, targetPhone: pending.targetPhone });
        await sendWhatsAppMessage({
          phone: collectorPhone,
          message: `¡Listo! Envié el promo a ${pending.targetPhone}.`
        });
      } catch (error) {
        logger.error("failed to send promo from collector flow", {
          collectorPhone,
          targetPhone: pending.targetPhone,
          error: (error as Error).message
        });
        await sendWhatsAppMessage({
          phone: collectorPhone,
          message: "No pude enviar el promo. Intenta de nuevo con una foto nueva."
        });
      }
      return;
    }

    // "no" or any unexpected id
    logger.verbose("collector declined promo send", { collectorPhone, buttonReplyId });
    await sendWhatsAppMessage({
      phone: collectorPhone,
      message: "Ok, no envié nada."
    });
    return;
  }

  // ------------------------------------------------------------------
  // Branch 2: image — OCR extraction + confirmation
  // ------------------------------------------------------------------
  if (messageType === "image" && imageUrl) {
    let extractedRaw: string;
    try {
      const result = await invokeLLM(
        deps.collectorAgent ?? PHONE_EXTRACTOR_AGENT,
        [], // no chat history — stateless extraction
        "", // user text is empty; the image carries all the info
        imageUrl,
        undefined,
        true
      );
      extractedRaw = (typeof result === "string" ? result : result.text).trim();
    } catch (error) {
      logger.error("vision extraction failed for collector image", {
        collectorPhone,
        error: (error as Error).message
      });
      await sendWhatsAppMessage({
        phone: collectorPhone,
        message: "No pude analizar la foto. Intenta de nuevo."
      });
      return;
    }

    logger.verbose("vision extraction result", { collectorPhone, extractedRaw });

    if (!extractedRaw || extractedRaw.toUpperCase() === "NONE") {
      await sendWhatsAppMessage({
        phone: collectorPhone,
        message: "No vi ningún número en la foto. Por favor toma otra foto."
      });
      return;
    }

    const e164 = extractE164(extractedRaw);
    if (!e164) {
      logger.verbose("collector extracted number failed E.164 parsing", {
        collectorPhone,
        extractedRaw
      });
      await sendWhatsAppMessage({
        phone: collectorPhone,
        message: `No pude leer el número correctamente (vi: ${extractedRaw}). Por favor toma otra foto.`
      });
      return;
    }

    setPending(collectorPhone, e164);

    await sendWhatsAppMessage({
      phone: collectorPhone,
      replyButtons: {
        bodyText: `Encontré el número *${e164}*. ¿Envío el promo?`,
        buttons: [
          { id: "yes", title: "Sí, enviar" },
          { id: "no", title: "No" }
        ]
      }
    });
    return;
  }

  // ------------------------------------------------------------------
  // Branch 3: anything else (text, audio, video, sticker, …)
  // ------------------------------------------------------------------
  logger.verbose("collector sent non-image non-button message", { collectorPhone, messageType });
  await sendWhatsAppMessage({
    phone: collectorPhone,
    message: "Solo puedo ayudarte a enviar el promo. Envíame una foto del negocio."
  });
}

/** Clear all pending promos — for testing only. */
export function clearPendingPromosForTesting(): void {
  pendingPromos.clear();
}
