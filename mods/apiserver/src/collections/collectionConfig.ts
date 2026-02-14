/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Environment-based config for collection templates and behavior.
 * Template names and language code read once at startup; blank template = skip that type.
 */

/**
 * WhatsApp template language code (e.g. "es_DO" for Dominican Spanish).
 * Set via MIKRO_WA_LANGUAGE_CODE; defaults to "es_DO".
 */
export function getWhatsAppLanguageCode(): string {
  return (process.env.MIKRO_WA_LANGUAGE_CODE ?? "es_DO").trim() || "es_DO";
}

export const COLLECTION_TEMPLATE_NAMES = {
  paymentConfirmation: process.env.MIKRO_WA_TEMPLATE_PAYMENT_CONFIRMATION ?? "payment_receipt",
  paymentReminder: process.env.MIKRO_WA_TEMPLATE_PAYMENT_REMINDER ?? "payment_reminder",
  overdueNotice: process.env.MIKRO_WA_TEMPLATE_PAYMENT_OVERDUE ?? "payment_overdue"
} as const;

export function getPaymentConfirmationTemplateName(): string | null {
  const name = (process.env.MIKRO_WA_TEMPLATE_PAYMENT_CONFIRMATION ?? "payment_receipt").trim();
  return name.length > 0 ? name : null;
}

export function getPaymentReminderTemplateName(): string | null {
  const name = (process.env.MIKRO_WA_TEMPLATE_PAYMENT_REMINDER ?? "payment_reminder").trim();
  return name.length > 0 ? name : null;
}

export function getOverdueNoticeTemplateName(): string | null {
  const name = (process.env.MIKRO_WA_TEMPLATE_PAYMENT_OVERDUE ?? "payment_overdue").trim();
  return name.length > 0 ? name : null;
}
