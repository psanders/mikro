/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  whatsappWebhookSchema,
  type WhatsAppWebhookBody,
  type WhatsAppMessage
} from "@mikro/common";

/**
 * Result of handling a WhatsApp webhook.
 */
export interface HandleWhatsAppMessageResult {
  messagesProcessed: number;
  /** Phone numbers that sent messages (useful for sending responses) */
  senders: string[];
}

/**
 * Handle incoming WhatsApp webhook messages.
 *
 * This function validates and processes incoming WhatsApp webhook payloads.
 * Currently implements a placeholder that logs messages to console.
 *
 * @param body - The raw webhook body from WhatsApp
 * @returns Result indicating number of messages processed and sender phone numbers
 * @throws {ValidationError} When the webhook payload is invalid
 *
 * @example
 * ```typescript
 * import { handleWhatsAppMessage } from "@mikro/agents";
 * import { ValidationError } from "@mikro/common";
 *
 * app.post('/webhook', async (req, res) => {
 *   try {
 *     const result = await handleWhatsAppMessage(req.body);
 *     console.log(`Processed ${result.messagesProcessed} messages`);
 *     res.status(200).send('OK');
 *   } catch (error) {
 *     if (error instanceof ValidationError) {
 *       console.error("Invalid webhook payload:", error.message);
 *     }
 *     res.status(200).send('OK'); // Always return 200 to WhatsApp
 *   }
 * });
 * ```
 */
export const handleWhatsAppMessage = (() => {
  const fn = async (webhookBody: WhatsAppWebhookBody): Promise<HandleWhatsAppMessageResult> => {
    // Only process whatsapp_business_account events
    if (webhookBody.object !== "whatsapp_business_account") {
      console.log("[WhatsApp] Ignoring non-whatsapp_business_account event:", webhookBody.object);
      return { messagesProcessed: 0, senders: [] };
    }

    let messagesProcessed = 0;
    const senders: string[] = [];
    const entries = webhookBody.entry ?? [];

    for (const entry of entries) {
      const changes = entry.changes ?? [];

      for (const change of changes) {
        const messages = change.value?.messages ?? [];

        for (const message of messages) {
          processMessage(message);
          messagesProcessed++;
          if (!senders.includes(message.from)) {
            senders.push(message.from);
          }
        }
      }
    }

    return { messagesProcessed, senders };
  };

  return withErrorHandlingAndValidation(fn, whatsappWebhookSchema);
})();

/**
 * Process a single WhatsApp message.
 * Placeholder implementation that logs the message.
 *
 * @param message - The WhatsApp message to process
 */
function processMessage(message: WhatsAppMessage): void {
  const { from, type, id, text, image } = message;

  console.log("[WhatsApp] Incoming message:", {
    messageId: id,
    from,
    type,
    text: text?.body,
    imageId: image?.id,
    imageCaption: image?.caption
  });

  // TODO: Implement actual message processing logic
  // - Check if member exists
  // - Process with AI agent
  // - Send response back via WhatsApp
}
