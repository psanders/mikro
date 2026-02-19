/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Initiate COLLECTION_CALL (Fonoster) for customers who are too far behind (red threshold).
 */

import type { PrismaClient } from "../generated/prisma/client.js";
import { initiateCollectionCall } from "./fonosterClient.js";
import {
  executeCollectionAction,
  isDryRun,
  logDryRun,
  Channel,
  AttemptType,
  type CollectionTarget
} from "./collectionAttemptHelper.js";

export interface ProcessCollectionCallsDeps {
  db: PrismaClient;
}

export interface CustomerLoanPairWithMissed {
  customer: { id: string; name: string; phone: string };
  loan: {
    id: string;
    loanId: number;
    principal: number;
    termLength: number;
    paymentAmount: number;
    paymentFrequency: string;
  };
  missedPayments: number;
}

/**
 * Initiate a collection call for each (customer, loan) pair. Logs attempt in DB.
 */
export async function processCollectionCalls(
  pairs: CustomerLoanPairWithMissed[],
  deps: ProcessCollectionCallsDeps
): Promise<void> {
  const dryRun = isDryRun();

  for (const { customer, loan, missedPayments } of pairs) {
    const target: CollectionTarget = { customer, loan };

    if (dryRun) {
      logDryRun({ channel: "PHONE_CALL", type: "COLLECTION_CALL", target, missedPayments });
    } else {
      await executeCollectionAction(
        async () => {
          const { ref } = await initiateCollectionCall({
            phone: customer.phone,
            loan: {
              loanId: loan.loanId,
              principal: loan.principal,
              termLength: loan.termLength,
              paymentAmount: loan.paymentAmount,
              paymentFrequency: loan.paymentFrequency,
              missedPayments,
              customerName: customer.name
            }
          });
          return ref;
        },
        deps.db,
        { target, channel: Channel.PHONE_CALL, type: AttemptType.COLLECTION_CALL, missedPayments }
      );
    }
  }
}
