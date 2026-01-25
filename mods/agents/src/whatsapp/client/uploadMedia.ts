/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { WhatsAppApiError } from "./types.js";
import { logger } from "../../logger.js";

export async function uploadMedia(
  phoneNumberId: string,
  accessToken: string,
  imageBuffer: Buffer,
  mimeType: string
): Promise<string> {
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
    throw new Error(
      `WhatsApp media upload error: ${errorMessage}${errorCode ? ` (Code: ${errorCode})` : ""}`
    );
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
}
