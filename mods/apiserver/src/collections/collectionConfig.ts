/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Config for collection templates and behavior (from mikro.json).
 */

import { getConfig } from "@mikro/common";

/**
 * WhatsApp template language code (e.g. "es_DO" for Dominican Spanish).
 */
export function getWhatsAppLanguageCode(): string {
  return getConfig().whatsapp.languageCode;
}

export const COLLECTION_TEMPLATE_NAMES = {
  get paymentConfirmation(): string {
    return getConfig().whatsapp.templates.paymentConfirmation;
  },
  get paymentReminder(): string {
    return getConfig().whatsapp.templates.paymentReminder;
  },
  get overdueNotice(): string {
    return getConfig().whatsapp.templates.paymentOverdue;
  }
};

export function getPaymentConfirmationTemplateName(): string | null {
  const name = getConfig().whatsapp.templates.paymentConfirmation.trim();
  return name.length > 0 ? name : null;
}

export function getPaymentReminderTemplateName(): string | null {
  const name = getConfig().whatsapp.templates.paymentReminder.trim();
  return name.length > 0 ? name : null;
}

export function getOverdueNoticeTemplateName(): string | null {
  const name = getConfig().whatsapp.templates.paymentOverdue.trim();
  return name.length > 0 ? name : null;
}
