/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { SendWhatsAppMessageInput, WhatsAppSendResponse } from "@mikro/common";
import type { WhatsAppApiError } from "./types.js";
import { logger } from "../../logger.js";

export async function sendMessage(
  phoneNumberId: string,
  accessToken: string,
  params: SendWhatsAppMessageInput
): Promise<WhatsAppSendResponse> {
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
    throw new Error(
      `WhatsApp API error: ${errorMessage}${errorCode ? ` (Code: ${errorCode})` : ""}`
    );
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
}
