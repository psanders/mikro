/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Repayment-schedule builder. Produces one row per cuota from a canonical
 * LoanSnapshot: due date via `getLoanDueDate`, coverage/amount via the FIFO
 * waterfall-allocation helper. It reuses `buildLoanSnapshot`'s output (terms,
 * ledger, asOf) and does NOT recompute terms, due dates, or health — the loan
 * math lives only in the eval framework and the allocation helper.
 */
import { getLoanDueDate } from "../utils/dueDates.js";
import type { PaymentFrequency } from "../utils/calculateLoan.js";
import type { LoanSnapshot } from "../eval/snapshot.js";
import { allocatePaymentsToCuotas } from "./allocation.js";

/** Status of one scheduled cuota. Drives the PDF status pills (text-only). */
export type ScheduleRowStatus = "PAID" | "PARTIAL" | "OVERDUE" | "UPCOMING";

/** One row of the per-cuota repayment schedule. */
export interface RepaymentScheduleRow {
  /** 1-based cuota number. */
  cuota: number;
  /** Due date for this cuota (ISO), from `getLoanDueDate`. */
  dueDate: string;
  /** ISO date this cuota became fully covered, or null. */
  coverageDate: string | null;
  /** Text status pill value. */
  status: ScheduleRowStatus;
  /** Money applied to this cuota (0..cuota). */
  amountApplied: number;
}

/**
 * Build the per-cuota repayment schedule for a loan snapshot. Returns exactly
 * `snapshot.terms.termLength` rows, cuota 1..T, each with a due date from
 * `getLoanDueDate` and coverage/amount from the allocation helper.
 *
 * @param snapshot - a canonical LoanSnapshot (from `buildLoanSnapshot`)
 */
export function buildRepaymentSchedule(snapshot: LoanSnapshot): RepaymentScheduleRow[] {
  const { terms, ledger, asOf } = snapshot;
  const dueFields = {
    startingDate: terms.startingDate != null ? new Date(terms.startingDate) : null,
    firstDueDate: terms.storedFirstDueDate != null ? new Date(terms.storedFirstDueDate) : null,
    createdAt: new Date(terms.createdAt),
    paymentFrequency: terms.paymentFrequency as PaymentFrequency
  };
  const asOfTime = new Date(asOf).getTime();

  const allocations = allocatePaymentsToCuotas({
    payments: ledger.map((l) => ({
      kind: l.kind,
      status: l.status,
      amount: l.amount,
      paidAt: l.paidAt
    })),
    cuota: terms.cuota,
    termLength: terms.termLength
  });

  return allocations.map((a) => {
    // cycleIndex is 0-based: cuota N due date uses cycleIndex N-1.
    const dueDate = getLoanDueDate(dueFields, a.cuota - 1);

    let status: ScheduleRowStatus;
    if (a.covered) {
      status = "PAID";
    } else if (a.amountApplied > 0) {
      status = "PARTIAL";
    } else if (dueDate.getTime() < asOfTime) {
      status = "OVERDUE";
    } else {
      status = "UPCOMING";
    }

    return {
      cuota: a.cuota,
      dueDate: dueDate.toISOString(),
      coverageDate: a.coverageDate,
      status,
      amountApplied: a.amountApplied
    };
  });
}
