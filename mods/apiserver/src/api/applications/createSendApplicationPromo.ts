/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { SendWhatsAppTemplateInput, WhatsAppSendResponse } from "@mikro/common";
import { logger } from "../../logger.js";

/** Outcome of attempting to send the promo template for an application. */
export interface PromoResult {
  sent: boolean;
  messageId?: string;
  error?: string;
}

interface Deps {
  /** Bound WhatsApp client template sender. */
  sendTemplateMessage: (params: SendWhatsAppTemplateInput) => Promise<WhatsAppSendResponse>;
  /** Approved promo template name (CTA opens the intake Flow). */
  templateName: string;
  /** Language code the template is registered under. */
  languageCode: string;
  /** Public URL for the template's image header (required per-send parameter). */
  imageUrl: string;
}

interface SendArgs {
  phone: string | null;
  /** Token for the template's Flow button; echoed back on Flow submission. */
  flowToken: string;
}

/**
 * Send the approved promo template to an application's phone. Best-effort: a null
 * phone or a WhatsApp error resolves to `{ sent: false, error }` rather than
 * throwing, so the caller (manual creation) never rolls back over a failed send.
 */
export function createSendApplicationPromo(deps: Deps) {
  return async ({ phone, flowToken }: SendArgs): Promise<PromoResult> => {
    if (!phone) return { sent: false, error: "La solicitud no tiene teléfono." };
    if (!deps.imageUrl) {
      return {
        sent: false,
        error: "Falta configurar whatsapp.templates.loanApplicationPromoImageUrl."
      };
    }
    try {
      const res = await deps.sendTemplateMessage({
        phone,
        templateName: deps.templateName,
        languageCode: deps.languageCode,
        headerParameters: [],
        bodyParameters: [],
        // The template has an IMAGE header (per-send parameter).
        headerImageUrl: deps.imageUrl,
        // The promo template's CTA is a WhatsApp Flow button; the send must carry
        // a flow token. Correlation is by phone, so the value is opaque (we use
        // the application id) but it is required for the template format to match.
        flowToken
      });
      const messageId = res.messages?.[0]?.id;
      logger.verbose("application promo sent", { phone, messageId });
      return { sent: true, messageId };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error("failed to send application promo", { phone, error });
      return { sent: false, error };
    }
  };
}
