/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Environment-based config for collection templates and behavior.
 * Template names read once at startup; blank = skip that collection type.
 */

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
