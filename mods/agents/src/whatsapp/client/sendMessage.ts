/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type {
  SendWhatsAppMessageInput,
  SendWhatsAppTemplateInput,
  WhatsAppSendResponse
} from "@mikro/common";
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

  // Interactive Flow message takes precedence: an entirely different request
  // body (a button that opens a native in-chat form). Text/media are ignored.
  if (params.flow) {
    const f = params.flow;
    const requestBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: params.phone,
      type: "interactive",
      interactive: {
        type: "flow",
        ...(f.header && { header: { type: "text", text: f.header } }),
        body: { text: f.body },
        ...(f.footer && { footer: { text: f.footer } }),
        action: {
          name: "flow",
          parameters: {
            flow_message_version: "3",
            flow_token: f.flowToken,
            flow_id: f.flowId,
            flow_cta: f.cta,
            flow_action: "navigate",
            ...(f.mode && { mode: f.mode }),
            flow_action_payload: { screen: f.screen }
          }
        }
      }
    };
    logger.verbose("sending whatsapp flow message", {
      phone: params.phone,
      flowId: f.flowId,
      screen: f.screen
    });
    return sendRequest(url, accessToken, params.phone, "flow", requestBody);
  }

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

  return sendRequest(url, accessToken, params.phone, mediaType, requestBody);
}

/**
 * POST a prepared message body to the WhatsApp Graph API and parse the response.
 * Shared by text, media, and interactive (Flow) sends.
 */
async function sendRequest(
  url: string,
  accessToken: string,
  phone: string,
  kind: string,
  requestBody: Record<string, unknown>
): Promise<WhatsAppSendResponse> {
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
  } catch {
    logger.error("failed to parse whatsapp response", {
      phone,
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
      phone,
      error: errorMessage,
      errorCode,
      errorType,
      status: response.status,
      fullResponse: JSON.stringify(data),
      requestBody: kind !== "text" ? JSON.stringify(requestBody) : undefined
    });
    throw new Error(
      `WhatsApp API error: ${errorMessage}${errorCode ? ` (Code: ${errorCode})` : ""}`
    );
  }

  if (kind !== "text") {
    logger.verbose(`whatsapp ${kind} message response`, {
      phone,
      messageId: data.messages?.[0]?.id,
      kind,
      status: response.status
    });
  } else {
    logger.verbose("whatsapp api response received", {
      phone,
      messageId: data.messages?.[0]?.id,
      type: "text"
    });
  }

  return data;
}

/**
 * Send a WhatsApp template message (approved templates only).
 *
 * @param phoneNumberId - WhatsApp phone number ID
 * @param accessToken - WhatsApp API access token
 * @param params - Template name, language code, and body parameters
 * @returns The API response with message ID
 */
export async function sendTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  params: SendWhatsAppTemplateInput
): Promise<WhatsAppSendResponse> {
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  const headerParameters = params.headerParameters ?? [];
  const bodyParameters = params.bodyParameters ?? [];

  const toParamObject = (
    p: string | { parameter_name: string; text: string }
  ): { type: "text"; text: string; parameter_name?: string } => {
    if (typeof p === "string") {
      return { type: "text", text: p };
    }
    return { type: "text", parameter_name: p.parameter_name, text: p.text };
  };

  type TemplateParam =
    | { type: "text"; text: string; parameter_name?: string }
    | { type: "image"; image: { link: string } }
    | {
        type: "action";
        action: { flow_token: string; flow_action_data?: Record<string, unknown> };
      };
  const components: Array<{
    type: string;
    sub_type?: string;
    index?: string;
    parameters: TemplateParam[];
  }> = [];
  // An image header is a per-send parameter and must precede text header params.
  if (params.headerImageUrl) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { link: params.headerImageUrl } }]
    });
  }
  if (headerParameters.length > 0) {
    components.push({
      type: "header",
      parameters: headerParameters.map(toParamObject)
    });
  }
  if (bodyParameters.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParameters.map(toParamObject)
    });
  }
  // Flow CTA templates require a button component carrying the flow token; the
  // template's defined format includes the Flow button, so omitting this fails
  // with error 132012 ("parameter format does not match the created template").
  if (params.flowToken) {
    components.push({
      type: "button",
      sub_type: "flow",
      index: "0",
      parameters: [
        {
          type: "action",
          action: {
            flow_token: params.flowToken,
            ...(params.flowActionData ? { flow_action_data: params.flowActionData } : {})
          }
        }
      ]
    });
  }
  const requestBody = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.phone,
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.languageCode },
      components
    }
  };

  logger.verbose("sending whatsapp template request", {
    phone: params.phone,
    templateName: params.templateName,
    languageCode: params.languageCode
  });

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
  } catch {
    logger.error("failed to parse whatsapp template response", {
      phone: params.phone,
      status: response.status,
      responseText
    });
    throw new Error(`WhatsApp API returned invalid JSON: ${responseText}`);
  }

  if (!response.ok) {
    const errorMessage = data.error?.message ?? JSON.stringify(data);
    const errorCode = data.error?.code;
    logger.error("whatsapp template api error", {
      phone: params.phone,
      templateName: params.templateName,
      error: errorMessage,
      errorCode,
      status: response.status
    });
    throw new Error(
      `WhatsApp API error: ${errorMessage}${errorCode ? ` (Code: ${errorCode})` : ""}`
    );
  }

  logger.verbose("whatsapp template message sent", {
    phone: params.phone,
    messageId: data.messages?.[0]?.id,
    templateName: params.templateName
  });

  return data;
}
