/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { SendWhatsAppMessageInput } from "../schemas/whatsapp.js";

/**
 * Response from WhatsApp API when sending a message.
 */
export interface WhatsAppSendResponse {
  messages?: Array<{ id: string }>;
}

/**
 * Response from WhatsApp media upload.
 */
export interface WhatsAppMediaUploadResponse {
  id: string;
}

/**
 * WhatsApp client interface for dependency injection.
 * Implement this interface to provide WhatsApp API functionality.
 */
export interface WhatsAppClient {
  /**
   * Send a message via WhatsApp (text, image, document, video, or audio).
   *
   * Supported message types:
   * - Text: provide phone and message
   * - Image: provide phone and (imageUrl or mediaId with mediaType="image"), optional caption
   * - Document: provide phone and (documentUrl or documentId or mediaId with mediaType="document"), optional caption and filename
   * - Video: provide phone and (videoUrl or videoId or mediaId with mediaType="video"), optional caption
   * - Audio: provide phone and (audioUrl or audioId or mediaId with mediaType="audio"), no caption
   *
   * @param params - The phone number, message/media, and optional caption
   * @returns The API response with message ID
   */
  sendMessage(params: SendWhatsAppMessageInput): Promise<WhatsAppSendResponse>;

  /**
   * Upload media (image, document, video, or audio) to WhatsApp and get a media ID.
   *
   * Supported formats:
   * - Images: PNG, JPEG, GIF, WebP (max 5 MB)
   * - Documents: PDF, Word, Excel, PowerPoint, TXT (max 100 MB)
   * - Video: MP4, 3GPP (max 16 MB)
   * - Audio: AAC, AMR, MP3, M4A, OGG (max 16 MB)
   *
   * @param fileBuffer - Buffer containing the media data
   * @param mimeType - MIME type of the media (e.g., "image/png", "application/pdf", "video/mp4")
   * @returns The media ID that can be used to send the media
   */
  uploadMedia(fileBuffer: Buffer, mimeType: string): Promise<string>;

  /**
   * Download media from WhatsApp.
   * @param mediaId - The WhatsApp media ID
   * @returns Base64 data URL of the media
   */
  downloadMedia(mediaId: string): Promise<string>;
}
