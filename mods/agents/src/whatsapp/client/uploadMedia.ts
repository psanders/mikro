/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { WhatsAppApiError } from "./types.js";
import { logger } from "../../logger.js";

/**
 * Get a default filename based on the MIME type.
 */
function getFilenameFromMimeType(mimeType: string): string {
  const mimeToExtension: Record<string, string> = {
    // Images
    "image/png": "file.png",
    "image/jpeg": "file.jpg",
    "image/gif": "file.gif",
    "image/webp": "file.webp",
    // Documents
    "application/pdf": "file.pdf",
    "application/msword": "file.doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "file.docx",
    "application/vnd.ms-excel": "file.xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "file.xlsx",
    "application/vnd.ms-powerpoint": "file.ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "file.pptx",
    "text/plain": "file.txt",
    // Video
    "video/mp4": "file.mp4",
    "video/3gpp": "file.3gp",
    // Audio
    "audio/aac": "file.aac",
    "audio/amr": "file.amr",
    "audio/mpeg": "file.mp3",
    "audio/mp4": "file.m4a",
    "audio/ogg": "file.ogg"
  };

  return mimeToExtension[mimeType] || "file.bin";
}

/**
 * Upload media (image, document, video, or audio) to WhatsApp and get a media ID.
 *
 * Supported formats:
 * - Images: PNG, JPEG, GIF, WebP (max 5 MB)
 * - Documents: PDF, Word, Excel, PowerPoint, TXT (max 100 MB)
 * - Video: MP4, 3GPP (max 16 MB)
 * - Audio: AAC, AMR, MP3, M4A, OGG (max 16 MB)
 *
 * @param phoneNumberId - WhatsApp phone number ID
 * @param accessToken - WhatsApp API access token
 * @param fileBuffer - Buffer containing the media data
 * @param mimeType - MIME type of the media (e.g., "image/png", "application/pdf", "video/mp4")
 * @returns The media ID that can be used to send the media
 */
export async function uploadMedia(
  phoneNumberId: string,
  accessToken: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/media`;
  logger.verbose("uploading media to whatsapp", {
    size: fileBuffer.length,
    mimeType
  });

  // Use manual multipart/form-data construction
  // WhatsApp API requires: file, type, messaging_product
  // Boundary format should not start with dashes (standard format)
  const boundary = `FormBoundary${Date.now()}${Math.random().toString(36).substring(2, 15)}`;
  const CRLF = "\r\n";
  const parts: Buffer[] = [];

  // Get appropriate filename based on MIME type
  const filename = getFilenameFromMimeType(mimeType);

  // File part - WhatsApp expects this first
  const fileHeader = Buffer.from(
    `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}Content-Type: ${mimeType}${CRLF}${CRLF}`,
    "utf-8"
  );
  parts.push(fileHeader);
  parts.push(fileBuffer);

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
    type: mimeType,
    filename
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
    size: fileBuffer.length
  });

  return data.id;
}
