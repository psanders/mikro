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
}

export interface ComputeAccruedMoraResult {
  moraAmount: number;
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

/**
 * Accrued mora as of `asOfDate` (not reduced by any LATE_FEE payments — callers subtract collected separately if needed).
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
    policy
  } = input;

  let asOf = new Date(asOfDate);
  if (policy.moraStopOnDefault && loanStatus === "DEFAULTED" && loanUpdatedAt) {
    asOf = new Date(Math.min(asOf.getTime(), loanUpdatedAt.getTime()));
  }

  const { paymentsMade, missedCycles } = getCycleMetrics(loanData, asOf);

  if (missedCycles <= 0 || moraRate <= 0 || paymentAmount <= 0) {
    return {
      moraAmount: 0,
      daysLate: 0,
      missedCycles,
      capApplied: false,
      graceApplied: false
    };
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
    return {
      moraAmount: 0,
      daysLate,
      missedCycles,
      capApplied: false,
      graceApplied: true
    };
  }

  const rawMora = moraRate * (daysLate / 30) * paymentAmount;
  const cap = policy.moraCapInCuotas * paymentAmount;
  const capped = cap > 0 ? Math.min(rawMora, cap) : rawMora;
  const capApplied = capped < rawMora - 1e-9;

  let moraAmount = capped;
  if (policy.moraMinDop > 0 && moraAmount > 0 && moraAmount < policy.moraMinDop) {
    moraAmount = policy.moraMinDop;
  }

  return {
    moraAmount: Number(moraAmount.toFixed(2)),
    daysLate,
    missedCycles,
    capApplied,
    graceApplied: false
  };
}
