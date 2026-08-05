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
  /**
   * Accrual start this charge was computed from, frozen when the row was written.
   * Undefined on rows predating anchoring — those contribute no anchor and the
   * window falls back to the loan's current oldest missed due date.
   */
  moraAccrualFrom?: Date | null;
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
  /**
   * Accrual start gross was measured from. Persist this on a LATE_FEE row when
   * charging, so a later read reproduces the same window.
   */
  accrualFrom: Date | null;
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
 * Where accrual for the current spell starts.
 *
 * Normally the oldest missed due date. But a LATE_FEE row charged earlier in the
 * same spell froze the window it was measured over, and applying its payment may
 * since have pushed the oldest missed due forward — so the earliest anchor among
 * the rows in the window wins when it predates that due date. Rows written
 * before anchoring existed carry no anchor and are simply not consulted, which
 * leaves historical loans behaving exactly as they did.
 *
 * Widening the window can pull in rows that were previously outside it, and
 * those may carry earlier anchors still, so this walks back to a fixpoint.
 */
function resolveAccrualStart(input: {
  oldestMissedDue: Date;
  effectiveFrom: Date | null;
  asOf: Date;
  collectedLateFeePayments?: CollectedLateFeePayment[];
}): Date {
  const { oldestMissedDue, effectiveFrom, asOf, collectedLateFeePayments } = input;

  const floor = effectiveFrom ? Math.max(oldestMissedDue.getTime(), effectiveFrom.getTime()) : null;
  const clamp = (ms: number) => (floor != null ? Math.max(ms, floor) : ms);

  let startMs = clamp(oldestMissedDue.getTime());
  if (!collectedLateFeePayments?.length) return new Date(startMs);

  const asOfMs = asOf.getTime();

  // Bounded by the number of rows: each pass either settles or moves the window
  // start strictly earlier, which can only happen once per row.
  for (let pass = 0; pass <= collectedLateFeePayments.length; pass++) {
    let earliest = startMs;

    for (const p of collectedLateFeePayments) {
      if (p.status === "REVERSED" || p.moraAccrualFrom == null) continue;
      const paidMs = new Date(p.paidAt).getTime();
      if (paidMs < startMs || paidMs > asOfMs) continue;
      const anchorMs = clamp(new Date(p.moraAccrualFrom).getTime());
      if (anchorMs < earliest) earliest = anchorMs;
    }

    if (earliest >= startMs) break;
    startMs = earliest;
  }

  return new Date(startMs);
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
    graceApplied,
    accrualFrom: null
  });

  let asOf = new Date(asOfDate);
  if (policy.moraStopOnDefault && loanStatus === "DEFAULTED" && loanUpdatedAt) {
    asOf = new Date(Math.min(asOf.getTime(), loanUpdatedAt.getTime()));
  }

  const { paymentsMade, missedCycles } = getCycleMetrics(loanData, asOf);

  if (missedCycles <= 0 || moraRate <= 0 || paymentAmount <= 0) {
    return zeroMora(missedCycles, 0, false);
  }

  const oldestMissedDue = getDueDateForCycle(
    loanStart,
    paymentsMade,
    paymentFrequency,
    preferredPaymentDay
  );
  const effectiveFrom = parseEffectiveFrom(policy.moraEffectiveFrom ?? null);

  // Mora already charged in this spell froze the window it was measured over.
  // Honouring those anchors is what stops the payment that carried the mora
  // from retroactively shortening the window it was charged against.
  const accrualStart = resolveAccrualStart({
    oldestMissedDue,
    effectiveFrom,
    asOf,
    collectedLateFeePayments
  });

  const daysLate = Math.max(0, Math.floor((asOf.getTime() - accrualStart.getTime()) / MS_PER_DAY));

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

  // Same window on both sides: gross is measured from `accrualStart`, so mora
  // collected from that instant onward is what nets against it.
  const collectedMora = sumCollectedMoraForWindow(collectedLateFeePayments, accrualStart, asOf);
  const netMora = Math.max(0, grossMoraAmount - collectedMora);

  return {
    moraAmount: Number(netMora.toFixed(2)),
    grossMoraAmount,
    collectedMora: Number(collectedMora.toFixed(2)),
    daysLate,
    missedCycles,
    capApplied,
    graceApplied: false,
    accrualFrom: accrualStart
  };
}
