/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Helpers for member report: missed count, times late, trend, rating, row highlight.
 */
import type { LoanPaymentData } from "./calculatePaymentStatus.js";
import { getCycleMetrics } from "./calculatePaymentStatus.js";
import {
  LOOKBACK_WEEKS_FOR_LATENESS,
  TREND_LOOKBACK_WEEKS,
  LATE_DAYS_THRESHOLD,
  HIGHLIGHT_YELLOW_MIN_MISSED,
  HIGHLIGHT_YELLOW_TIMES_LATE_IN_LOOKBACK,
  HIGHLIGHT_RED_MIN_MISSED,
  HIGHLIGHT_RED_DETERIORATING_MIN_MISSED
} from "./memberReportConstants.js";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Trend direction for lateness. */
export type LatenessTrend = "mejorando" | "estable" | "empeorando";

/** Row highlight color for report. */
export type ReportRowHighlight = null | "yellow" | "red";

/**
 * Returns the number of missed payment cycles (weeks behind) as of a date.
 */
export function getMissedPaymentsCount(loan: LoanPaymentData, asOfDate: Date = new Date()): number {
  const { missedCycles } = getCycleMetrics(loan, asOfDate);
  return Math.max(0, missedCycles);
}

/**
 * Counts how many of the last `weeks` cycles had a payment made more than
 * LATE_DAYS_THRESHOLD days after the cycle due date. Only applies to weekly loans;
 * for daily loans returns 0.
 */
export function getTimesLateInLastWeeks(
  loan: LoanPaymentData,
  weeks: number = LOOKBACK_WEEKS_FOR_LATENESS,
  asOfDate: Date = new Date()
): number {
  if (loan.paymentFrequency !== "WEEKLY") return 0;

  const loanStart = new Date(loan.createdAt);
  const asOf = new Date(asOfDate);
  const { cyclesElapsed } = getCycleMetrics(loan, asOf);

  const sortedPayments = [...loan.payments]
    .filter((p) => new Date(p.paidAt) <= asOf)
    .sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime());

  let lateCount = 0;
  const startCycle = Math.max(0, cyclesElapsed - weeks);
  for (
    let cycleIndex = startCycle;
    cycleIndex < cyclesElapsed && cycleIndex < sortedPayments.length;
    cycleIndex++
  ) {
    const payment = sortedPayments[cycleIndex];
    // Cycle i is due at end of week i+1 (e.g. cycle 0 due at day 7)
    const dueDate = new Date(loanStart.getTime() + (cycleIndex + 1) * 7 * MS_PER_DAY);
    const paidAt = new Date(payment.paidAt);
    const daysAfterDue = Math.floor((paidAt.getTime() - dueDate.getTime()) / MS_PER_DAY);
    if (daysAfterDue > LATE_DAYS_THRESHOLD) lateCount++;
  }
  return lateCount;
}

/**
 * Returns whether the account is improving, stable, or deteriorating compared to
 * TREND_LOOKBACK_WEEKS ago.
 */
export function getLatenessTrend(
  loan: LoanPaymentData,
  asOfDate: Date = new Date()
): LatenessTrend {
  const now = new Date(asOfDate);
  const past = new Date(now.getTime() - TREND_LOOKBACK_WEEKS * 7 * MS_PER_DAY);

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
  const timesLate = getTimesLateInLastWeeks(loan, LOOKBACK_WEEKS_FOR_LATENESS, asOfDate);
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
  const timesLate = getTimesLateInLastWeeks(loan, LOOKBACK_WEEKS_FOR_LATENESS, asOfDate);
  const trend = getLatenessTrend(loan, asOfDate);

  if (missed >= HIGHLIGHT_RED_MIN_MISSED) return "red";
  if (trend === "empeorando" && missed >= HIGHLIGHT_RED_DETERIORATING_MIN_MISSED) return "red";
  if (missed >= HIGHLIGHT_YELLOW_MIN_MISSED) return "yellow";
  if (timesLate >= HIGHLIGHT_YELLOW_TIMES_LATE_IN_LOOKBACK) return "yellow";
  return null;
}
