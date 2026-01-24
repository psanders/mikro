/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { SendWhatsAppMessageInput, WhatsAppClient, WhatsAppSendResponse } from "@mikro/common";
import { getWhatsAppPhoneNumberId, getWhatsAppAccessToken } from "../config.js";

/**
 * WhatsApp API response for media URL lookup.
 */
interface MediaUrlResponse {
  url?: string;
  error?: unknown;
}

/**
 * WhatsApp API error response.
 */
interface WhatsAppApiError {
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
}

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
    sendMessage: async (params: SendWhatsAppMessageInput): Promise<WhatsAppSendResponse> => {
      const phoneNumberId = getWhatsAppPhoneNumberId();
      const accessToken = getWhatsAppAccessToken();

      const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: params.phone,
          type: "text",
          text: {
            body: params.message
          }
        })
      });

      const data = (await response.json()) as WhatsAppSendResponse & WhatsAppApiError;

      if (!response.ok) {
        const errorMessage = data.error?.message ?? JSON.stringify(data);
        throw new Error(`WhatsApp API error: ${errorMessage}`);
      }

      return data;
    },

    downloadMedia: async (mediaId: string): Promise<string> => {
      const accessToken = getWhatsAppAccessToken();

      // Step 1: Get media URL from WhatsApp API
      const mediaUrl = `https://graph.facebook.com/v18.0/${mediaId}`;

      const mediaResponse = await fetch(mediaUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!mediaResponse.ok) {
        const errorData = (await mediaResponse.json()) as WhatsAppApiError;
        const errorMessage = errorData.error?.message ?? JSON.stringify(errorData);
        throw new Error(`Failed to get media URL: ${errorMessage}`);
      }

      const mediaData = (await mediaResponse.json()) as MediaUrlResponse;

      if (!mediaData.url) {
        throw new Error("Media URL not found in response");
      }

      // Step 2: Download the actual media
      const downloadResponse = await fetch(mediaData.url, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!downloadResponse.ok) {
        throw new Error(
          `Failed to download media: ${downloadResponse.status} ${downloadResponse.statusText}`
        );
      }

      // Step 3: Convert to base64 data URL
      const arrayBuffer = await downloadResponse.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      // Determine content type from response or default to PNG
      const contentType = downloadResponse.headers.get("content-type") ?? "image/png";

      return `data:${contentType};base64,${base64}`;
    }
  };
}
