/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * @mikro/agents - AI Agents and messaging integrations
 */

// WhatsApp integration
export {
  handleWhatsAppMessage,
  createSendWhatsAppMessage,
  createWhatsAppClient,
  type HandleWhatsAppMessageResult
} from "./whatsapp/index.js";

// Config utilities
export {
  getWebhookVerifyToken,
  getWhatsAppPhoneNumberId,
  getWhatsAppAccessToken
} from "./config.js";
