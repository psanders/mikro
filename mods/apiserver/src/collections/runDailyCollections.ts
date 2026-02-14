/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Daily cron orchestrator: reminders, overdue notices, collection calls.
 * Payment confirmations are event-driven only (not run here).
 */

import {
  getMissedPaymentsCount,
  COLLECTION_CALL_MIN_MISSED,
  COLLECTION_OVERDUE_MIN_MISSED,
  type LoanPaymentData
} from "@mikro/common";
import { CollectionAttemptStatus } from "../generated/prisma/enums.js";
import { isPaymentDayToday } from "./dayOfWeek.js";
import { processPaymentReminders, type MemberLoanPair } from "./processPaymentReminders.js";
import { processOverdueNotices, type MemberLoanPairWithMissed } from "./processOverdueNotices.js";
import {
  processCollectionCalls,
  type MemberLoanPairWithMissed as CallPair
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
 * Helper to compute missed payments for a loan row, avoiding repetition.
 */
function loanToData(loan: {
  paymentFrequency: string;
  createdAt: Date;
  payments: Array<{ paidAt: Date }>;
}): LoanPaymentData {
  return {
    paymentFrequency: loan.paymentFrequency,
    createdAt: loan.createdAt,
    payments: loan.payments.map((p) => ({ paidAt: p.paidAt }))
  };
}

/**
 * Run the daily collections process: reminders, overdue notices, collection calls.
 * Skips members already contacted today (e.g. by payment confirmation).
 */
export async function runDailyCollections(
  asOfDate: Date,
  deps: RunDailyCollectionsDeps
): Promise<void> {
  const start = startOfToday(asOfDate);
  const dryRun = isDryRun();
  const todayDow = getTodayDayOfWeek(asOfDate);

  logger.verbose("daily collections starting", {
    dryRun,
    asOfDate: asOfDate.toISOString(),
    dayOfWeek: todayDow
  });

  // Load all active members with their active loans. For each loan, include only COMPLETED
  // payments so that cycle metrics (getMissedPaymentsCount) count only actual payments made;
  // REVERSED or PENDING payments must not count as "payments made". Members with no
  // completed payments still appear (loans have payments: []).
  const members = await deps.db.member.findMany({
    where: { isActive: true },
    include: {
      loans: {
        where: { status: "ACTIVE" },
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
  const overdueList: MemberLoanPairWithMissed[] = [];
  const reminderList: MemberLoanPair[] = [];
  let skippedNoLoans = 0;
  let skippedContactedToday = 0;
  let skippedNoAction = 0;

  for (const member of members) {
    if (member.loans.length === 0) {
      skippedNoLoans++;
      continue;
    }

    const contactedToday = await deps.db.collectionAttempt.findFirst({
      where: {
        memberId: member.id,
        status: CollectionAttemptStatus.SENT,
        createdAt: { gte: start }
      }
    });
    if (contactedToday) {
      skippedContactedToday++;
      if (dryRun) {
        logger.verbose("collection skip: already contacted today", {
          memberId: member.id,
          memberName: member.name,
          attemptType: contactedToday.type
        });
      }
      continue;
    }

    type LoanRow = (typeof member.loans)[0];
    const memberInfo = {
      id: member.id,
      name: member.name,
      phone: member.phone,
      preferredPaymentDay: member.preferredPaymentDay
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

    for (const loan of member.loans) {
      const loanData = loanToData(loan);
      const missed = getMissedPaymentsCount(loanData, asOfDate);
      const paymentDay = isPaymentDayToday(
        loan.paymentFrequency,
        member.preferredPaymentDay,
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
        const callMissed = callLoan ? getMissedPaymentsCount(loanToData(callLoan), asOfDate) : 0;
        if (!callLoan || missed > callMissed) callLoan = loan;
      } else if (missed >= COLLECTION_OVERDUE_MIN_MISSED) {
        if (!overdueLoan) overdueLoan = loan;
      } else if (missed === 0 && paymentDay) {
        if (!reminderLoan) reminderLoan = loan;
      }
    }

    // Determine which list the member goes into
    let action: string;

    if (callLoan) {
      action = "COLLECTION_CALL";
      const missed = getMissedPaymentsCount(loanToData(callLoan), asOfDate);
      callList.push({
        member: memberInfo,
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
      const missed = getMissedPaymentsCount(loanToData(overdueLoan), asOfDate);
      overdueList.push({
        member: memberInfo,
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
        member: memberInfo,
        loan: {
          id: reminderLoan.id,
          loanId: reminderLoan.loanId,
          paymentAmount: reminderLoan.paymentAmount,
          paymentFrequency: reminderLoan.paymentFrequency
        }
      });
    } else {
      // Member has active loans but no action: missed is between 1 and
      // COLLECTION_OVERDUE_MIN_MISSED-1, or missed === 0 and today is not payment day.
      action = "NONE";
      skippedNoAction++;
    }

    if (dryRun) {
      logger.verbose("collection member evaluation", {
        memberId: member.id,
        memberName: member.name,
        preferredPaymentDay: member.preferredPaymentDay ?? "not set",
        action,
        loans: loanDiagnostics
      });
    }
  }

  logger.verbose("daily collections summary", {
    dryRun,
    totalMembers: members.length,
    skippedNoLoans,
    skippedContactedToday,
    skippedNoAction,
    callCount: callList.length,
    overdueCount: overdueList.length,
    reminderCount: reminderList.length
  });

  await processCollectionCalls(callList, { db: deps.db });
  await processOverdueNotices(overdueList, deps);
  await processPaymentReminders(reminderList, deps);
}
