/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Send OVERDUE_NOTICE template to members who are behind (yellow threshold).
 */

import { getOverdueNoticeTemplateName, getWhatsAppLanguageCode } from "./collectionConfig.js";
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

export interface MemberLoanPairWithMissed {
  member: { id: string; name: string; phone: string };
  loan: {
    id: string;
    loanId: number;
    paymentAmount: unknown;
  };
  missedPayments: number;
}

/**
 * Send overdue notice template for each (member, loan) pair.
 */
export async function processOverdueNotices(
  pairs: MemberLoanPairWithMissed[],
  deps: CollectionDeps
): Promise<void> {
  const templateName = getOverdueNoticeTemplateName();
  if (!templateName) return;
  const languageCode = getWhatsAppLanguageCode();
  const dryRun = isDryRun();

  for (const { member, loan, missedPayments } of pairs) {
    const target: CollectionTarget = { member, loan };

    if (dryRun) {
      logDryRun({
        channel: "WHATSAPP",
        type: "OVERDUE_NOTICE",
        target,
        templateName,
        missedPayments
      });
    } else {
      await executeCollectionAction(
        async () => {
          const res = await deps.sendWhatsAppTemplate({
            phone: member.phone,
            templateName,
            languageCode,
            bodyParameters: []
          });
          return res.messages?.[0]?.id ?? null;
        },
        deps.db,
        {
          target,
          channel: Channel.WHATSAPP,
          type: AttemptType.OVERDUE_NOTICE,
          templateName,
          missedPayments
        }
      );
      await delay(COLLECTION_MESSAGE_DELAY_MS);
    }
  }
}
