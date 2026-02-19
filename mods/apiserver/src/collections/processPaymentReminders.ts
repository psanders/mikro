/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Send PAYMENT_REMINDER template to customers whose payment day is today and are on track.
 */

import { getPaymentReminderTemplateName } from "./collectionConfig.js";
import { formatPaymentDayForTemplate } from "./dayOfWeek.js";
import { delay } from "./rateLimiter.js";
import { COLLECTION_MESSAGE_DELAY_MS } from "@mikro/common";
import {
  executeCollectionAction,
  isDryRun,
  logDryRun,
  Channel,
  AttemptType,
  type CollectionDeps,
  type CollectionTarget
} from "./collectionAttemptHelper.js";

export interface CustomerLoanPair {
  customer: { id: string; name: string; phone: string; preferredPaymentDay: string | null };
  loan: {
    id: string;
    loanId: number;
    paymentAmount: unknown;
    paymentFrequency: string;
  };
}

/**
 * Send reminder template for each (customer, loan) pair. One send per pair with rate limit between.
 */
export async function processPaymentReminders(
  pairs: CustomerLoanPair[],
  deps: CollectionDeps
): Promise<void> {
  const templateName = getPaymentReminderTemplateName();
  if (!templateName) return;
  const languageCode = "es"; // TODO: Update at Facebook to use es_DO
  const dryRun = isDryRun();

  for (const { customer, loan } of pairs) {
    const paymentDay = formatPaymentDayForTemplate(
      loan.paymentFrequency,
      customer.preferredPaymentDay
    );
    const target: CollectionTarget = {
      customer: { id: customer.id, name: customer.name, phone: customer.phone },
      loan
    };
    const bodyParameters = [paymentDay];

    if (dryRun) {
      logDryRun({
        channel: "WHATSAPP",
        type: "PAYMENT_REMINDER",
        target,
        templateName,
        bodyParameters
      });
    } else {
      await executeCollectionAction(
        async () => {
          const res = await deps.sendWhatsAppTemplate({
            phone: customer.phone,
            templateName,
            languageCode,
            bodyParameters
          });
          return res.messages?.[0]?.id ?? null;
        },
        deps.db,
        {
          target,
          channel: Channel.WHATSAPP,
          type: AttemptType.PAYMENT_REMINDER,
          templateName,
          missedPayments: 0
        }
      );
      await delay(COLLECTION_MESSAGE_DELAY_MS);
    }
  }
}
