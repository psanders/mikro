/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

/**
 * WhatsApp API response for media URL lookup.
 */
export interface MediaUrlResponse {
  url?: string;
  error?: unknown;
}

/**
 * WhatsApp API error response.
 */
export interface WhatsAppApiError {
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
}
