/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Helpers for customer report: missed count, times late, trend, rating, row highlight.
 */
import type { LoanPaymentData } from "./calculatePaymentStatus.js";
import {
  getCycleMetrics,
  getDueDateForCycle,
  getLateDaysThreshold,
  MS_PER_DAY
} from "./calculatePaymentStatus.js";
import {
  LOOKBACK_WEEKS_FOR_LATENESS,
  TREND_LOOKBACK_WEEKS,
  HIGHLIGHT_YELLOW_MIN_MISSED,
  HIGHLIGHT_YELLOW_TIMES_LATE_IN_LOOKBACK,
  HIGHLIGHT_RED_MIN_MISSED,
  HIGHLIGHT_RED_DETERIORATING_MIN_MISSED
} from "./customerReportConstants.js";

/** Trend direction for lateness. */
export type LatenessTrend = "mejorando" | "estable" | "empeorando";

/**
 * Returns human-readable Spanish label for payment frequency.
 */
export function formatPaymentFrequency(freq: string): string {
  if (freq === "DAILY") return "Diario";
  if (freq === "WEEKLY") return "Semanal";
  if (freq === "BIWEEKLY") return "Quincenal";
  if (freq === "MONTHLY") return "Mensual";
  return freq;
}

/** Row highlight color for report. */
export type ReportRowHighlight = null | "yellow" | "red";

/**
 * Returns the number of missed payment cycles as of a date.
 */
export function getMissedPaymentsCount(loan: LoanPaymentData, asOfDate: Date = new Date()): number {
  const { missedCycles } = getCycleMetrics(loan, asOfDate);
  return Math.max(0, missedCycles);
}

/**
 * Frequency-aware trend lookback in days. Returns the number of days to
 * look back when comparing current missed count to past missed count.
 */
function getTrendLookbackDays(freq: string): number {
  switch (freq) {
    case "BIWEEKLY":
      return 42;
    case "MONTHLY":
      return 90;
    default:
      return TREND_LOOKBACK_WEEKS * 7;
  }
}

/**
 * Counts how many of the last `lookbackCycles` cycles had a payment made
 * more than the frequency-specific late-days threshold after the cycle due
 * date. Returns 0 for DAILY loans (lateness tracking not applicable).
 */
export function getTimesLateInLookback(
  loan: LoanPaymentData,
  lookbackCycles: number = LOOKBACK_WEEKS_FOR_LATENESS,
  asOfDate: Date = new Date()
): number {
  if (loan.paymentFrequency === "DAILY") return 0;

  const startDate = new Date(loan.startingDate ?? loan.createdAt);
  const asOf = new Date(asOfDate);
  const { cyclesElapsed } = getCycleMetrics(loan, asOf);

  const sortedPayments = [...loan.payments]
    .filter((p) => new Date(p.paidAt) <= asOf)
    .filter((p) => p.status === undefined || p.status === "COMPLETED")
    .sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime());

  const threshold = getLateDaysThreshold(loan.paymentFrequency);

  let lateCount = 0;
  const startCycle = Math.max(0, cyclesElapsed - lookbackCycles);
  for (
    let cycleIndex = startCycle;
    cycleIndex < cyclesElapsed && cycleIndex < sortedPayments.length;
    cycleIndex++
  ) {
    const payment = sortedPayments[cycleIndex];
    const dueDate = getDueDateForCycle(
      startDate,
      cycleIndex,
      loan.paymentFrequency,
      loan.preferredPaymentDay
    );
    const paidAt = new Date(payment.paidAt);
    const daysAfterDue = Math.floor((paidAt.getTime() - dueDate.getTime()) / MS_PER_DAY);
    if (daysAfterDue > threshold) lateCount++;
  }
  return lateCount;
}

/** @deprecated Use getTimesLateInLookback instead. */
export const getTimesLateInLastWeeks = getTimesLateInLookback;

/**
 * Returns whether the account is improving, stable, or deteriorating compared to
 * a frequency-aware lookback period ago.
 */
export function getLatenessTrend(
  loan: LoanPaymentData,
  asOfDate: Date = new Date()
): LatenessTrend {
  const now = new Date(asOfDate);
  const lookbackDays = getTrendLookbackDays(loan.paymentFrequency);
  const past = new Date(now.getTime() - lookbackDays * MS_PER_DAY);

  const missedNow = getMissedPaymentsCount(loan, now);
  const missedPast = getMissedPaymentsCount(loan, past);

  if (missedNow < missedPast) return "mejorando";
  if (missedNow > missedPast) return "empeorando";
  return "estable";
}

/**
 * Returns a rating from 1 (worst) to 5 (best) based on missed count, times late
 * in lookback, and trend.
 */
export function getPaymentRating(
  loan: LoanPaymentData,
  asOfDate: Date = new Date()
): 1 | 2 | 3 | 4 | 5 {
  const missed = getMissedPaymentsCount(loan, asOfDate);
  const timesLate = getTimesLateInLookback(loan, LOOKBACK_WEEKS_FOR_LATENESS, asOfDate);
  const trend = getLatenessTrend(loan, asOfDate);

  if (missed >= HIGHLIGHT_RED_MIN_MISSED) return 1;
  if (trend === "empeorando" && missed >= HIGHLIGHT_RED_DETERIORATING_MIN_MISSED) return 1;
  if (missed >= HIGHLIGHT_YELLOW_MIN_MISSED) return 2;
  if (timesLate >= HIGHLIGHT_YELLOW_TIMES_LATE_IN_LOOKBACK && missed >= 1) return 2;
  if (missed === 1) return 3;
  if (timesLate >= 1 && missed === 0) return 4;
  return 5;
}

/**
 * Returns the row highlight color: null (no color), yellow, or red. Only highlights
 * when "really stopped paying" (2+ missed, chronically late, or 3+ missed / deteriorating).
 */
export function getReportRowHighlight(
  loan: LoanPaymentData,
  asOfDate: Date = new Date()
): ReportRowHighlight {
  const missed = getMissedPaymentsCount(loan, asOfDate);
  const timesLate = getTimesLateInLookback(loan, LOOKBACK_WEEKS_FOR_LATENESS, asOfDate);
  const trend = getLatenessTrend(loan, asOfDate);

  if (missed >= HIGHLIGHT_RED_MIN_MISSED) return "red";
  if (trend === "empeorando" && missed >= HIGHLIGHT_RED_DETERIORATING_MIN_MISSED) return "red";
  if (missed >= HIGHLIGHT_YELLOW_MIN_MISSED) return "yellow";
  if (timesLate >= HIGHLIGHT_YELLOW_TIMES_LATE_IN_LOOKBACK) return "yellow";
  return null;
}
