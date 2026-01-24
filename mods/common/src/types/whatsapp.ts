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
 * WhatsApp client interface for dependency injection.
 * Implement this interface to provide WhatsApp API functionality.
 */
export interface WhatsAppClient {
  /**
   * Send a text message via WhatsApp.
   * @param params - The phone number and message to send
   * @returns The API response with message ID
   */
  sendMessage(params: SendWhatsAppMessageInput): Promise<WhatsAppSendResponse>;

  /**
   * Download media from WhatsApp.
   * @param mediaId - The WhatsApp media ID
   * @returns Base64 data URL of the media
   */
  downloadMedia(mediaId: string): Promise<string>;
}
