/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Past-due (mora) fee: one cuota's worth, daily-prorated over 30 calendar days.
 */
import {
  getCycleMetrics,
  getDueDateForCycle,
  MS_PER_DAY,
  type LoanPaymentData
} from "./calculatePaymentStatus.js";
import type { LoansConfig } from "../config.js";

export interface CollectedLateFeePayment {
  paidAt: Date;
  amount: number;
  status: string;
}

export interface ComputeAccruedMoraInput {
  loanData: LoanPaymentData;
  /** Resolved mora rate (e.g. loan override or config default). */
  moraRate: number;
  paymentAmount: number;
  paymentFrequency: string;
  preferredPaymentDay: string | null;
  loanStart: Date;
  asOfDate: Date;
  loanStatus: "ACTIVE" | "COMPLETED" | "DEFAULTED" | "CANCELLED";
  /** When moraStopOnDefault and loan is DEFAULTED, cap as-of to this instant. */
  loanUpdatedAt?: Date;
  policy: Pick<
    LoansConfig,
    "moraGraceDays" | "moraCapInCuotas" | "moraMinDop" | "moraStopOnDefault" | "moraEffectiveFrom"
  >;
  /**
   * Non-reversed LATE_FEE rows already collected. When set, `moraAmount` is net of mora paid
   * on or after the oldest missed-cycle due date (cycle anchor via `paymentsMade` is unchanged).
   */
  collectedLateFeePayments?: CollectedLateFeePayment[];
}

export interface ComputeAccruedMoraResult {
  /** Net mora still owed (gross minus collected for the current missed-cycle window). */
  moraAmount: number;
  /** Policy-suggested mora before subtracting collected LATE_FEE for this window. */
  grossMoraAmount: number;
  /** Sum of non-reversed LATE_FEE paid on or after oldest missed due (and on or before as-of). */
  collectedMora: number;
  daysLate: number;
  missedCycles: number;
  capApplied: boolean;
  graceApplied: boolean;
}

function parseEffectiveFrom(iso: string | null | undefined): Date | null {
  if (iso == null || iso === "") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(y, mo, d, 0, 0, 0, 0);
}

/**
 * Days from oldest unpaid installment due date to as-of (calendar days, floor).
 * Matches export-loan-situation `diasAtraso` when missedCycles > 0.
 */
export function daysLateFromOldestDue(
  loanStart: Date,
  paymentFrequency: string,
  preferredPaymentDay: string | null,
  paymentsMade: number,
  missedCycles: number,
  asOf: Date
): number {
  if (missedCycles <= 0) return 0;
  const due = getDueDateForCycle(loanStart, paymentsMade, paymentFrequency, preferredPaymentDay);
  return Math.max(0, Math.floor((asOf.getTime() - due.getTime()) / MS_PER_DAY));
}

function sumCollectedMoraForWindow(
  collectedLateFeePayments: CollectedLateFeePayment[] | undefined,
  oldestMissedDue: Date | null,
  asOf: Date
): number {
  if (!collectedLateFeePayments?.length || !oldestMissedDue) return 0;
  const dueMs = oldestMissedDue.getTime();
  const asOfMs = asOf.getTime();
  let sum = 0;
  for (const p of collectedLateFeePayments) {
    if (p.status === "REVERSED") continue;
    const paidMs = new Date(p.paidAt).getTime();
    if (paidMs >= dueMs && paidMs <= asOfMs) {
      sum += p.amount;
    }
  }
  return sum;
}

/**
 * Accrued mora as of `asOfDate`. When `collectedLateFeePayments` is provided, `moraAmount` is net
 * of LATE_FEE already collected for the current missed-cycle window.
 */
export function computeAccruedMora(input: ComputeAccruedMoraInput): ComputeAccruedMoraResult {
  const {
    loanData,
    moraRate,
    paymentAmount,
    paymentFrequency,
    preferredPaymentDay,
    loanStart,
    asOfDate,
    loanStatus,
    loanUpdatedAt,
    policy,
    collectedLateFeePayments
  } = input;

  const zeroMora = (
    missedCycles: number,
    daysLate: number,
    graceApplied: boolean
  ): ComputeAccruedMoraResult => ({
    moraAmount: 0,
    grossMoraAmount: 0,
    collectedMora: 0,
    daysLate,
    missedCycles,
    capApplied: false,
    graceApplied
  });

  let asOf = new Date(asOfDate);
  if (policy.moraStopOnDefault && loanStatus === "DEFAULTED" && loanUpdatedAt) {
    asOf = new Date(Math.min(asOf.getTime(), loanUpdatedAt.getTime()));
  }

  const { paymentsMade, missedCycles } = getCycleMetrics(loanData, asOf);

  if (missedCycles <= 0 || moraRate <= 0 || paymentAmount <= 0) {
    return zeroMora(missedCycles, 0, false);
  }

  let daysLate = daysLateFromOldestDue(
    loanStart,
    paymentFrequency,
    preferredPaymentDay,
    paymentsMade,
    missedCycles,
    asOf
  );

  const effectiveFrom = parseEffectiveFrom(policy.moraEffectiveFrom ?? null);
  if (effectiveFrom) {
    const oldestDue = getDueDateForCycle(
      loanStart,
      paymentsMade,
      paymentFrequency,
      preferredPaymentDay
    );
    const accrualStart = new Date(Math.max(oldestDue.getTime(), effectiveFrom.getTime()));
    daysLate = Math.max(0, Math.floor((asOf.getTime() - accrualStart.getTime()) / MS_PER_DAY));
  }

  const graceApplied = daysLate <= policy.moraGraceDays;
  if (graceApplied) {
    return zeroMora(missedCycles, daysLate, true);
  }

  const rawMora = moraRate * (daysLate / 30) * paymentAmount;
  const cap = policy.moraCapInCuotas * paymentAmount;
  const capped = cap > 0 ? Math.min(rawMora, cap) : rawMora;
  const capApplied = capped < rawMora - 1e-9;

  let grossMoraAmount = capped;
  if (policy.moraMinDop > 0 && grossMoraAmount > 0 && grossMoraAmount < policy.moraMinDop) {
    grossMoraAmount = policy.moraMinDop;
  }
  grossMoraAmount = Number(grossMoraAmount.toFixed(2));

  const oldestMissedDue = getDueDateForCycle(
    loanStart,
    paymentsMade,
    paymentFrequency,
    preferredPaymentDay
  );
  const collectedMora = sumCollectedMoraForWindow(collectedLateFeePayments, oldestMissedDue, asOf);
  const netMora = Math.max(0, grossMoraAmount - collectedMora);

  return {
    moraAmount: Number(netMora.toFixed(2)),
    grossMoraAmount,
    collectedMora: Number(collectedMora.toFixed(2)),
    daysLate,
    missedCycles,
    capApplied,
    graceApplied: false
  };
}
