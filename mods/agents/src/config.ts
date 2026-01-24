/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

/**
 * Validate that a string environment variable is set and non-empty.
 * @param value - The environment variable value
 * @param fieldName - The field name for error messages
 * @returns The validated string
 * @throws Error if the value is not set or empty
 */
function validateRequired(value: string | undefined, fieldName: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`${fieldName} environment variable is not set or invalid`);
  }
  return value;
}

/**
 * Get WhatsApp webhook verify token from environment.
 * @returns The verify token, defaults to 'mikro_webhook_token'
 */
export function getWebhookVerifyToken(): string {
  const token = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!token || token.trim().length === 0) {
    return "mikro_webhook_token"; // Default value
  }

  return token;
}

/**
 * Get WhatsApp Phone Number ID from environment.
 * @returns The phone number ID
 * @throws Error if not set
 */
export function getWhatsAppPhoneNumberId(): string {
  return validateRequired(process.env.WHATSAPP_PHONE_NUMBER_ID, "WHATSAPP_PHONE_NUMBER_ID");
}

/**
 * Get WhatsApp Access Token from environment.
 * @returns The access token
 * @throws Error if not set
 */
export function getWhatsAppAccessToken(): string {
  return validateRequired(process.env.WHATSAPP_ACCESS_TOKEN, "WHATSAPP_ACCESS_TOKEN");
}
