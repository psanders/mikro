/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { SendWhatsAppMessageInput, WhatsAppClient, WhatsAppSendResponse } from "@mikro/common";
import { getWhatsAppPhoneNumberId, getWhatsAppAccessToken } from "../config.js";
import { logger } from "../logger.js";

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
      const isImageMessage = !!(params.imageUrl || params.mediaId);
      logger.verbose("sending whatsapp api request", {
        phone: params.phone,
        type: isImageMessage ? "image" : "text",
        usingMediaId: !!params.mediaId,
        usingImageUrl: !!params.imageUrl
      });

      // Build the request body based on message type
      let requestBody: Record<string, unknown>;

      if (isImageMessage) {
        // Image message with optional caption
        // Prefer mediaId over imageUrl (more reliable)
        // IMPORTANT: Never send both mediaId and imageUrl - WhatsApp may show a link instead
        if (params.mediaId) {
          requestBody = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: params.phone,
            type: "image",
            image: {
              id: params.mediaId,
              ...(params.caption && { caption: params.caption })
            }
          };
          // Log warning if imageUrl is also provided (should not happen)
          if (params.imageUrl) {
            logger.warn("both mediaId and imageUrl provided, using mediaId only", {
              phone: params.phone,
              mediaId: params.mediaId
            });
          }
        } else if (params.imageUrl) {
          requestBody = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: params.phone,
            type: "image",
            image: {
              link: params.imageUrl,
              ...(params.caption && { caption: params.caption })
            }
          };
        } else {
          throw new Error("Either imageUrl or mediaId must be provided for image messages");
        }
      } else {
        // Text message
        requestBody = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: params.phone,
          type: "text",
          text: {
            body: params.message
          }
        };
      }

      // Log the request body for debugging (without sensitive data)
      if (isImageMessage && params.mediaId) {
        logger.verbose("sending whatsapp image message with mediaId", {
          phone: params.phone,
          mediaId: params.mediaId,
          hasCaption: !!params.caption,
          requestBody: JSON.stringify(requestBody)
        });
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      const responseText = await response.text();
      let data: WhatsAppSendResponse & WhatsAppApiError;
      
      try {
        data = JSON.parse(responseText) as WhatsAppSendResponse & WhatsAppApiError;
      } catch (parseError) {
        logger.error("failed to parse whatsapp response", {
          phone: params.phone,
          status: response.status,
          responseText
        });
        throw new Error(`WhatsApp API returned invalid JSON: ${responseText}`);
      }

      if (!response.ok) {
        const errorMessage = data.error?.message ?? JSON.stringify(data);
        const errorCode = data.error?.code;
        const errorType = data.error?.type;
        logger.error("whatsapp api error", {
          phone: params.phone,
          error: errorMessage,
          errorCode,
          errorType,
          status: response.status,
          fullResponse: JSON.stringify(data),
          requestBody: isImageMessage && params.mediaId ? JSON.stringify(requestBody) : undefined
        });
        throw new Error(`WhatsApp API error: ${errorMessage}${errorCode ? ` (Code: ${errorCode})` : ""}`);
      }

      // Log full response for debugging image issues
      if (isImageMessage) {
        logger.verbose("whatsapp image message response", {
          phone: params.phone,
          messageId: data.messages?.[0]?.id,
          imageUrl: params.imageUrl,
          mediaId: params.mediaId,
          fullResponse: JSON.stringify(data),
          status: response.status
        });
      } else {
        logger.verbose("whatsapp api response received", {
          phone: params.phone,
          messageId: data.messages?.[0]?.id,
          type: "text"
        });
      }
      return data;
    },

    uploadMedia: async (imageBuffer: Buffer, mimeType: string): Promise<string> => {
      const phoneNumberId = getWhatsAppPhoneNumberId();
      const accessToken = getWhatsAppAccessToken();

      const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/media`;
      logger.verbose("uploading media to whatsapp", {
        size: imageBuffer.length,
        mimeType
      });

      // Use manual multipart/form-data construction
      // WhatsApp API requires: file, type, messaging_product
      // Boundary format should not start with dashes (standard format)
      const boundary = `FormBoundary${Date.now()}${Math.random().toString(36).substring(2, 15)}`;
      const CRLF = "\r\n";
      const parts: Buffer[] = [];

      // File part - WhatsApp expects this first
      const fileHeader = Buffer.from(
        `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="receipt.png"${CRLF}Content-Type: ${mimeType}${CRLF}${CRLF}`,
        "utf-8"
      );
      parts.push(fileHeader);
      parts.push(imageBuffer);

      // Type part
      const typePart = Buffer.from(
        `${CRLF}--${boundary}${CRLF}Content-Disposition: form-data; name="type"${CRLF}${CRLF}${mimeType}${CRLF}`,
        "utf-8"
      );
      parts.push(typePart);

      // Messaging product part - must be exactly "whatsapp"
      const productPart = Buffer.from(
        `${CRLF}--${boundary}${CRLF}Content-Disposition: form-data; name="messaging_product"${CRLF}${CRLF}whatsapp${CRLF}--${boundary}--${CRLF}`,
        "utf-8"
      );
      parts.push(productPart);

      const body = Buffer.concat(parts);
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`
      };

      logger.verbose("sending media upload request", {
        url,
        bodySize: body.length,
        boundary,
        hasFile: true,
        type: mimeType
      });

      const response = await fetch(url, {
        method: "POST",
        headers,
        body
      });

      const responseText = await response.text();
      let data: { id?: string } & WhatsAppApiError;
      
      try {
        data = JSON.parse(responseText) as { id: string } & WhatsAppApiError;
      } catch (parseError) {
        logger.error("failed to parse whatsapp response", {
          responseText,
          status: response.status
        });
        throw new Error(`WhatsApp API returned invalid JSON: ${responseText}`);
      }

      if (!response.ok) {
        const errorMessage = data.error?.message ?? JSON.stringify(data);
        const errorCode = data.error?.code;
        const errorType = data.error?.type;
        logger.error("whatsapp media upload error", {
          error: errorMessage,
          errorCode,
          errorType,
          status: response.status,
          statusText: response.statusText,
          fullResponse: JSON.stringify(data),
          requestUrl: url,
          bodySize: body.length,
          contentType: headers["Content-Type"]
        });
        throw new Error(`WhatsApp media upload error: ${errorMessage}${errorCode ? ` (Code: ${errorCode})` : ""}`);
      }

      if (!data.id) {
        logger.error("media id not found in upload response", { response: JSON.stringify(data) });
        throw new Error("Media ID not found in upload response");
      }

      logger.verbose("media uploaded to whatsapp", {
        mediaId: data.id,
        size: imageBuffer.length
      });

      return data.id;
    },

    downloadMedia: async (mediaId: string): Promise<string> => {
      const accessToken = getWhatsAppAccessToken();
      logger.verbose("downloading whatsapp media", { mediaId });

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
        logger.error("failed to get media url", { mediaId, error: errorMessage });
        throw new Error(`Failed to get media URL: ${errorMessage}`);
      }

      const mediaData = (await mediaResponse.json()) as MediaUrlResponse;

      if (!mediaData.url) {
        logger.error("media url not found in response", { mediaId });
        throw new Error("Media URL not found in response");
      }

      // Step 2: Download the actual media
      const downloadResponse = await fetch(mediaData.url, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!downloadResponse.ok) {
        logger.error("failed to download media", { mediaId, status: downloadResponse.status });
        throw new Error(
          `Failed to download media: ${downloadResponse.status} ${downloadResponse.statusText}`
        );
      }

      // Step 3: Convert to base64 data URL
      const arrayBuffer = await downloadResponse.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      // Determine content type from response or default to PNG
      const contentType = downloadResponse.headers.get("content-type") ?? "image/png";

      logger.verbose("whatsapp media downloaded", {
        mediaId,
        contentType,
        size: arrayBuffer.byteLength
      });
      return `data:${contentType};base64,${base64}`;
    }
  };
}
