/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { MediaUrlResponse, WhatsAppApiError } from "./types.js";
import { logger } from "../../logger.js";

export async function downloadMedia(accessToken: string, mediaId: string): Promise<string> {
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
