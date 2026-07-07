/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  sendPaymentConfirmationSchema,
  type SendPaymentConfirmationInput,
  type GenerateReceiptResponse,
  type SendWhatsAppTemplateInput,
  type WhatsAppSendResponse
} from "@mikro/common";
import type { RecordOutboundMessageFn } from "../messages/index.js";
import { logger } from "../../logger.js";

/**
 * Outcome of a payment-confirmation send. Best-effort: a WhatsApp error resolves
 * to `{ success: false, error }` rather than throwing.
 */
export interface SendPaymentConfirmationResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Dependencies for sending the customer-facing payment confirmation.
 */
export interface SendPaymentConfirmationDependencies {
  /** Generate the landscape receipt card + its signed token (variant: "card"). */
  generateReceiptCard: (params: { paymentId: string }) => Promise<GenerateReceiptResponse>;
  /** Bound WhatsApp client template sender. */
  sendTemplateMessage: (params: SendWhatsAppTemplateInput) => Promise<WhatsAppSendResponse>;
  /** Approved payment-confirmation template name. */
  templateName: string;
  /** Language code the template is registered under. */
  languageCode: string;
  /** Build the public image-header URL for a signed token. */
  buildImageUrl: (token: string) => string;
  /** Optional: track delivery + emit a founder-feed card for the send. */
  recordOutbound?: RecordOutboundMessageFn;
}

/**
 * Send the payment-confirmation template to the borrower. Mirrors the promo
 * send: the landscape receipt card is the template's IMAGE header (fetched by
 * WhatsApp from a public URL at send time), the body carries the customer name
 * and amount, and a "Descargar recibo" URL button points at the public
 * `/r/:token` verify page. Best-effort — never throws.
 */
export function createSendPaymentConfirmation(deps: SendPaymentConfirmationDependencies) {
  const fn = async (
    input: SendPaymentConfirmationInput
  ): Promise<SendPaymentConfirmationResponse> => {
    if (!input.phone) {
      return { success: false, error: "Phone number is required." };
    }
    try {
      const { token, receiptData } = await deps.generateReceiptCard({
        paymentId: input.paymentId
      });

      const amount = receiptData.totalPaid ?? receiptData.amountPaid ?? "";

      const res = await deps.sendTemplateMessage({
        phone: input.phone,
        templateName: deps.templateName,
        languageCode: deps.languageCode,
        // The template's IMAGE header is a per-send parameter (the receipt card).
        headerImageUrl: deps.buildImageUrl(token),
        headerParameters: [],
        bodyParameters: [
          { parameter_name: "name", text: receiptData.name },
          { parameter_name: "amount", text: amount }
        ],
        // "Descargar recibo" URL button: WhatsApp appends the token to the base
        // URL defined on the template (`{publicUrl}/r/{{1}}`).
        urlButtonParameter: token
      });

      const messageId = res.messages?.[0]?.id;
      logger.info("payment confirmation sent", {
        paymentId: input.paymentId,
        phone: input.phone,
        messageId
      });
      if (messageId && deps.recordOutbound) {
        await deps.recordOutbound({
          waMessageId: messageId,
          phone: input.phone,
          kind: "payment_confirmation",
          customerName: receiptData.name
        });
      }
      return { success: true, messageId };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error("failed to send payment confirmation", {
        paymentId: input.paymentId,
        phone: input.phone,
        error
      });
      return { success: false, error };
    }
  };

  return withErrorHandlingAndValidation(fn, sendPaymentConfirmationSchema);
}
