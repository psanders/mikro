/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { SendWhatsAppMessageInput, WhatsAppSendResponse } from "@mikro/common";
import type { WhatsAppApiError } from "./types.js";
import { logger } from "../../logger.js";

/**
 * Determine the media type from the input parameters.
 */
function getMediaType(
  params: SendWhatsAppMessageInput
): "text" | "image" | "document" | "video" | "audio" {
  // Explicit mediaType with mediaId
  if (params.mediaId && params.mediaType) {
    return params.mediaType;
  }

  // Specific media type fields
  if (params.documentUrl || params.documentId) return "document";
  if (params.videoUrl || params.videoId) return "video";
  if (params.audioUrl || params.audioId) return "audio";
  if (params.imageUrl || params.mediaId) return "image"; // Default mediaId to image for backward compatibility

  return "text";
}

/**
 * Get the media ID or URL for the given media type.
 */
function getMediaIdOrUrl(
  params: SendWhatsAppMessageInput,
  mediaType: "image" | "document" | "video" | "audio"
): { id?: string; link?: string } {
  switch (mediaType) {
    case "document":
      if (params.documentId) return { id: params.documentId };
      if (params.documentUrl) return { link: params.documentUrl };
      if (params.mediaId) return { id: params.mediaId };
      break;
    case "video":
      if (params.videoId) return { id: params.videoId };
      if (params.videoUrl) return { link: params.videoUrl };
      if (params.mediaId) return { id: params.mediaId };
      break;
    case "audio":
      if (params.audioId) return { id: params.audioId };
      if (params.audioUrl) return { link: params.audioUrl };
      if (params.mediaId) return { id: params.mediaId };
      break;
    case "image":
    default:
      if (params.mediaId) return { id: params.mediaId };
      if (params.imageUrl) return { link: params.imageUrl };
      break;
  }

  return {};
}

/**
 * Send a WhatsApp message (text, image, document, video, or audio).
 *
 * @param phoneNumberId - WhatsApp phone number ID
 * @param accessToken - WhatsApp API access token
 * @param params - Message parameters including phone, message/media, and optional caption
 * @returns The API response with message ID
 */
export async function sendMessage(
  phoneNumberId: string,
  accessToken: string,
  params: SendWhatsAppMessageInput
): Promise<WhatsAppSendResponse> {
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  const mediaType = getMediaType(params);

  logger.verbose("sending whatsapp api request", {
    phone: params.phone,
    type: mediaType,
    hasMediaId: !!params.mediaId,
    hasImageUrl: !!params.imageUrl,
    hasDocumentUrl: !!params.documentUrl,
    hasVideoUrl: !!params.videoUrl,
    hasAudioUrl: !!params.audioUrl
  });

  // Build the request body based on message type
  let requestBody: Record<string, unknown>;

  if (mediaType === "text") {
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
  } else if (mediaType === "image") {
    // Image message
    const mediaRef = getMediaIdOrUrl(params, "image");
    requestBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: params.phone,
      type: "image",
      image: {
        ...mediaRef,
        ...(params.caption && { caption: params.caption })
      }
    };
  } else if (mediaType === "document") {
    // Document message
    const mediaRef = getMediaIdOrUrl(params, "document");
    requestBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: params.phone,
      type: "document",
      document: {
        ...mediaRef,
        ...(params.caption && { caption: params.caption }),
        ...(params.documentFilename && { filename: params.documentFilename })
      }
    };
  } else if (mediaType === "video") {
    // Video message
    const mediaRef = getMediaIdOrUrl(params, "video");
    requestBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: params.phone,
      type: "video",
      video: {
        ...mediaRef,
        ...(params.caption && { caption: params.caption })
      }
    };
  } else if (mediaType === "audio") {
    // Audio message (no caption supported)
    const mediaRef = getMediaIdOrUrl(params, "audio");
    requestBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: params.phone,
      type: "audio",
      audio: {
        ...mediaRef
      }
    };
  } else {
    throw new Error(`Unsupported media type: ${mediaType}`);
  }

  // Log the request body for debugging (without sensitive data)
  if (mediaType !== "text") {
    logger.verbose(`sending whatsapp ${mediaType} message`, {
      phone: params.phone,
      mediaType,
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
      requestBody: mediaType !== "text" ? JSON.stringify(requestBody) : undefined
    });
    throw new Error(
      `WhatsApp API error: ${errorMessage}${errorCode ? ` (Code: ${errorCode})` : ""}`
    );
  }

  // Log response for debugging
  if (mediaType !== "text") {
    logger.verbose(`whatsapp ${mediaType} message response`, {
      phone: params.phone,
      messageId: data.messages?.[0]?.id,
      mediaType,
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
