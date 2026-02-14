/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Send PAYMENT_REMINDER template to members whose payment day is today and are on track.
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

export interface MemberLoanPair {
  member: { id: string; name: string; phone: string; preferredPaymentDay: string | null };
  loan: {
    id: string;
    loanId: number;
    paymentAmount: unknown;
    paymentFrequency: string;
  };
}

/**
 * Send reminder template for each (member, loan) pair. One send per pair with rate limit between.
 */
export async function processPaymentReminders(
  pairs: MemberLoanPair[],
  deps: CollectionDeps
): Promise<void> {
  const templateName = getPaymentReminderTemplateName();
  if (!templateName) return;
  const dryRun = isDryRun();

  for (const { member, loan } of pairs) {
    const paymentDay = formatPaymentDayForTemplate(
      loan.paymentFrequency,
      member.preferredPaymentDay
    );
    const target: CollectionTarget = { member, loan };
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
            phone: member.phone,
            templateName,
            languageCode: "es",
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
