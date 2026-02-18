/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Cycle metrics and loan payment data for report helpers (rating, trend, etc.).
 */

/**
 * Loan data required for cycle metrics and report helpers.
 */
export interface LoanPaymentData {
  paymentFrequency: string;
  createdAt: Date;
  payments: Array<{ paidAt: Date }>;
  /** Member's preferred payment day (e.g. "FRIDAY"). When set for WEEKLY loans,
   *  cycles are anchored to this day of the week so due dates fall on the
   *  member's preferred day rather than raw 7-day intervals from creation. */
  preferredPaymentDay?: string | null;
}

export interface CycleMetrics {
  intervalDays: number;
  cyclesElapsed: number;
  paymentsMade: number;
  missedCycles: number;
}

export const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Map DayOfWeek enum string to JS Date.getDay() number (0=Sun..6=Sat). Returns -1 if unknown. */
export function dayOfWeekToNumber(day: string): number {
  switch (day) {
    case "SUNDAY":
      return 0;
    case "MONDAY":
      return 1;
    case "TUESDAY":
      return 2;
    case "WEDNESDAY":
      return 3;
    case "THURSDAY":
      return 4;
    case "FRIDAY":
      return 5;
    case "SATURDAY":
      return 6;
    default:
      return -1;
  }
}

/**
 * Days from loan creation to the first occurrence of the preferred payment day
 * (strictly after creation).  When the loan is created ON the preferred day,
 * the first due date is the following week (returns 7).
 *
 * Returns 0 when the preferred day is unrecognised.
 */
export function daysToFirstPreferredDay(loanStart: Date, preferredDay: string): number {
  const dayNum = dayOfWeekToNumber(preferredDay);
  if (dayNum < 0) return 0;
  let gap = (dayNum - loanStart.getUTCDay() + 7) % 7;
  if (gap === 0) gap = 7;
  return gap;
}

/**
 * Compute cycle metrics for a loan as of a given date.
 * Payments with paidAt after asOfDate are not counted.
 *
 * For WEEKLY loans with a preferredPaymentDay the first due date is the
 * first occurrence of that day after loan creation (a grace period so the
 * member gets until their preferred day).  All subsequent due dates follow
 * every 7 days from there, keeping cycles permanently synced to the
 * preferred day.
 *
 * @param loan - Loan data
 * @param asOfDate - Defaults to now
 */
export function getCycleMetrics(loan: LoanPaymentData, asOfDate: Date = new Date()): CycleMetrics {
  const intervalDays = loan.paymentFrequency === "DAILY" ? 1 : 7;
  const loanStart = new Date(loan.createdAt);
  const asOf = new Date(asOfDate);

  const msSinceLoan = asOf.getTime() - loanStart.getTime();
  const daysSinceLoan = Math.floor(msSinceLoan / MS_PER_DAY);

  let cyclesElapsed: number;

  if (
    loan.paymentFrequency === "WEEKLY" &&
    loan.preferredPaymentDay &&
    dayOfWeekToNumber(loan.preferredPaymentDay) >= 0
  ) {
    const gap = daysToFirstPreferredDay(loanStart, loan.preferredPaymentDay);
    if (daysSinceLoan < gap) {
      cyclesElapsed = 0;
    } else {
      cyclesElapsed = Math.floor((daysSinceLoan - gap) / 7) + 1;
    }
  } else {
    cyclesElapsed = Math.max(0, Math.floor(daysSinceLoan / intervalDays));
  }

  const paymentsMade = loan.payments.filter((p) => new Date(p.paidAt) <= asOf).length;
  const missedCycles = cyclesElapsed - paymentsMade;

  return { intervalDays, cyclesElapsed, paymentsMade, missedCycles };
}
