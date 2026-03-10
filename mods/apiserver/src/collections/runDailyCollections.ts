/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Daily cron orchestrator: reminders, overdue notices, collection calls.
 * Payment confirmations are event-driven only (not run here).
 */

import {
  getMissedPaymentsCount,
  COLLECTION_CALL_MIN_MISSED,
  COLLECTION_OVERDUE_MIN_MISSED
} from "@mikro/common";
import { CollectionAttemptStatus } from "../generated/prisma/enums.js";
import { isPaymentDayToday } from "./dayOfWeek.js";
import { loanToData } from "./loanToData.js";
import { processPaymentReminders, type CustomerLoanPair } from "./processPaymentReminders.js";
import { processOverdueNotices, type CustomerLoanPairWithMissed } from "./processOverdueNotices.js";
import {
  processCollectionCalls,
  type CustomerLoanPairWithMissed as CallPair
} from "./processCollectionCalls.js";
import { isDryRun, type CollectionDeps } from "./collectionAttemptHelper.js";
import { getTodayDayOfWeek } from "./dayOfWeek.js";
import { logger } from "../logger.js";

export type RunDailyCollectionsDeps = CollectionDeps;

/**
 * Start of today in local time (00:00:00.000).
 */
function startOfToday(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Run the daily collections process: reminders, overdue notices, collection calls.
 * Skips customers already contacted today (e.g. by payment confirmation).
 */
export async function runDailyCollections(
  asOfDate: Date,
  deps: RunDailyCollectionsDeps,
  includeDefaulted = false,
  appRef?: string
): Promise<void> {
  const start = startOfToday(asOfDate);
  const dryRun = isDryRun();
  const todayDow = getTodayDayOfWeek(asOfDate);

  logger.verbose("daily collections starting", {
    dryRun,
    includeDefaulted,
    asOfDate: asOfDate.toISOString(),
    dayOfWeek: todayDow
  });

  // Load all active customers with their active (and optionally defaulted) loans. For each loan, include only COMPLETED
  // payments so that cycle metrics (getMissedPaymentsCount) count only actual payments made;
  // REVERSED or PENDING payments must not count as "payments made". Customers with no
  // completed payments still appear (loans have payments: []).
  const customers = await deps.db.customer.findMany({
    where: {
      isActive: true,
      NOT: { notificationPolicy: { collections: false } }
    },
    include: {
      loans: {
        where: { status: { in: includeDefaulted ? ["ACTIVE", "DEFAULTED"] : ["ACTIVE"] } },
        include: {
          payments: {
            where: { status: "COMPLETED" },
            orderBy: { paidAt: "asc" }
          }
        }
      }
    }
  });

  const callList: CallPair[] = [];
  const overdueList: CustomerLoanPairWithMissed[] = [];
  const reminderList: CustomerLoanPair[] = [];
  let skippedNoLoans = 0;
  let skippedContactedToday = 0;
  let skippedNoAction = 0;

  for (const customer of customers) {
    if (customer.loans.length === 0) {
      skippedNoLoans++;
      continue;
    }

    const contactedToday = await deps.db.collectionAttempt.findFirst({
      where: {
        customerId: customer.id,
        status: CollectionAttemptStatus.SENT,
        createdAt: { gte: start }
      }
    });
    if (contactedToday) {
      skippedContactedToday++;
      if (dryRun) {
        logger.verbose("collection skip: already contacted today", {
          customerId: customer.id,
          customerName: customer.name,
          attemptType: contactedToday.type
        });
      }
      continue;
    }

    type LoanRow = (typeof customer.loans)[0];
    const customerInfo = {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      preferredPaymentDay: customer.preferredPaymentDay
    };
    let callLoan: LoanRow | null = null;
    let overdueLoan: LoanRow | null = null;
    let reminderLoan: LoanRow | null = null;

    // Per-loan diagnostics for dry run
    const loanDiagnostics: Array<{
      loanId: number;
      missed: number;
      frequency: string;
      isPaymentDay: boolean;
    }> = [];

    for (const loan of customer.loans) {
      const loanData = loanToData(loan, customer.preferredPaymentDay);
      const missed = getMissedPaymentsCount(loanData, asOfDate);
      const paymentDay = isPaymentDayToday(
        loan.paymentFrequency,
        customer.preferredPaymentDay,
        loan.startingDate ?? loan.createdAt,
        asOfDate
      );

      if (dryRun) {
        loanDiagnostics.push({
          loanId: loan.loanId,
          missed,
          frequency: loan.paymentFrequency,
          isPaymentDay: paymentDay
        });
      }

      if (missed >= COLLECTION_CALL_MIN_MISSED) {
        const callMissed = callLoan
          ? getMissedPaymentsCount(loanToData(callLoan, customer.preferredPaymentDay), asOfDate)
          : 0;
        if (!callLoan || missed > callMissed) callLoan = loan;
      } else if (missed >= COLLECTION_OVERDUE_MIN_MISSED) {
        if (!overdueLoan) overdueLoan = loan;
      } else if (missed === 0 && paymentDay) {
        if (!reminderLoan) reminderLoan = loan;
      }
    }

    // Determine which list the customer goes into
    let action: string;

    if (callLoan) {
      action = "COLLECTION_CALL";
      const missed = getMissedPaymentsCount(
        loanToData(callLoan, customer.preferredPaymentDay),
        asOfDate
      );
      callList.push({
        customer: customerInfo,
        loan: {
          id: callLoan.id,
          loanId: callLoan.loanId,
          principal: Number(callLoan.principal),
          termLength: callLoan.termLength,
          paymentAmount: Number(callLoan.paymentAmount),
          paymentFrequency: callLoan.paymentFrequency
        },
        missedPayments: missed
      });
    } else if (overdueLoan) {
      action = "OVERDUE_NOTICE";
      const missed = getMissedPaymentsCount(
        loanToData(overdueLoan, customer.preferredPaymentDay),
        asOfDate
      );
      overdueList.push({
        customer: customerInfo,
        loan: {
          id: overdueLoan.id,
          loanId: overdueLoan.loanId,
          paymentAmount: overdueLoan.paymentAmount
        },
        missedPayments: missed
      });
    } else if (reminderLoan) {
      action = "PAYMENT_REMINDER";
      reminderList.push({
        customer: customerInfo,
        loan: {
          id: reminderLoan.id,
          loanId: reminderLoan.loanId,
          paymentAmount: reminderLoan.paymentAmount,
          paymentFrequency: reminderLoan.paymentFrequency,
          startingDate: reminderLoan.startingDate,
          createdAt: reminderLoan.createdAt
        }
      });
    } else {
      // Customer has active loans but no action: missed is between 1 and
      // COLLECTION_OVERDUE_MIN_MISSED-1, or missed === 0 and today is not payment day.
      action = "NONE";
      skippedNoAction++;
    }

    if (dryRun) {
      logger.verbose("collection customer evaluation", {
        customerId: customer.id,
        customerName: customer.name,
        preferredPaymentDay: customer.preferredPaymentDay ?? "not set",
        action,
        loans: loanDiagnostics
      });
    }
  }

  logger.verbose("daily collections summary", {
    dryRun,
    totalCustomers: customers.length,
    skippedNoLoans,
    skippedContactedToday,
    skippedNoAction,
    callCount: callList.length,
    overdueCount: overdueList.length,
    reminderCount: reminderList.length
  });

  await processCollectionCalls(callList, { db: deps.db, appRef });
  await processOverdueNotices(overdueList, deps);
  await processPaymentReminders(reminderList, deps);
}
