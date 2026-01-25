/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { WhatsAppClient } from "@mikro/common";
import { getWhatsAppPhoneNumberId, getWhatsAppAccessToken } from "../../config.js";
import { sendMessage as sendMessageImpl } from "./sendMessage.js";
import { uploadMedia as uploadMediaImpl } from "./uploadMedia.js";
import { downloadMedia as downloadMediaImpl } from "./downloadMedia.js";

/**
 * Creates a WhatsApp client that communicates with the Meta Graph API.
 *
 * The client uses the native fetch API to make HTTP requests to WhatsApp's
 * Cloud API (v18.0).
 *
 * @returns A WhatsAppClient implementation
 *
 * @example
 * ```typescript
 * const client = createWhatsAppClient();
 *
 * // Send a message
 * const response = await client.sendMessage({
 *   phone: "+1234567890",
 *   message: "Hello!"
 * });
 *
 * // Download media
 * const imageDataUrl = await client.downloadMedia("media-id-123");
 * ```
 */
export function createWhatsAppClient(): WhatsAppClient {
  return {
    sendMessage: async (params) => {
      const phoneNumberId = getWhatsAppPhoneNumberId();
      const accessToken = getWhatsAppAccessToken();
      return sendMessageImpl(phoneNumberId, accessToken, params);
    },

    uploadMedia: async (imageBuffer, mimeType) => {
      const phoneNumberId = getWhatsAppPhoneNumberId();
      const accessToken = getWhatsAppAccessToken();
      return uploadMediaImpl(phoneNumberId, accessToken, imageBuffer, mimeType);
    },

    downloadMedia: async (mediaId) => {
      const accessToken = getWhatsAppAccessToken();
      return downloadMediaImpl(accessToken, mediaId);
    }
  };
}
