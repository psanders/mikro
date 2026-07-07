/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Cycle metrics and loan payment data for report helpers (rating, trend, etc.).
 */

/**
 * Loan data required for cycle metrics and report helpers.
 *
 * **Important:** `payments` must contain only INSTALLMENT rows.
 * LATE_FEE payments must be filtered out before constructing this object,
 * otherwise cycle counts and arrears will be incorrect.
 * Use `toLoanPaymentData()` from `loanMoraHelpers` to build this correctly.
 */
export interface LoanPaymentData {
  paymentFrequency: string;
  createdAt: Date;
  /**
   * When `amount` is present on the rows AND `paymentAmount` is set on the loan,
   * payments made are counted by money: floor(sum of installment amounts / cuota).
   * PARTIAL rows then accumulate toward completed cuotas (previously partials
   * never advanced the cycle, freezing receipts and over-accruing mora).
   *
   * Fallback (no amounts): when `status` is present, only `COMPLETED` rows count.
   */
  payments: Array<{ paidAt: Date; status?: string; amount?: number }>;
  /** Cuota size. Required (along with per-payment `amount`) for money-based counting. */
  paymentAmount?: number;
  /** Customer's preferred payment day (e.g. "FRIDAY"). When set for WEEKLY loans,
   *  cycles are anchored to this day of the week so due dates fall on the
   *  customer's preferred day rather than raw 7-day intervals from creation. */
  preferredPaymentDay?: string | null;
  /** Optional cycle anchor date. When set, all cycle calculations use this
   *  instead of createdAt. Defaults to createdAt when absent. */
  startingDate?: Date | null;
  /** When set, elapsed due cycles and missed counts are capped to the loan term (SAN). */
  termLength?: number;
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
 * Returns the nominal interval in days for a given frequency.
 * For MONTHLY this returns 30 as an approximation; actual cycle counting
 * uses calendar-based math.
 */
function getIntervalDays(freq: string): number {
  switch (freq) {
    case "DAILY":
      return 1;
    case "WEEKLY":
      return 7;
    case "BIWEEKLY":
      return 14;
    case "MONTHLY":
      return 30;
    default:
      return 7;
  }
}

/**
 * Returns the per-frequency late-days threshold used to decide whether
 * a payment is "late" for reporting purposes.
 */
export function getLateDaysThreshold(freq: string): number {
  switch (freq) {
    case "DAILY":
      return 1;
    case "WEEKLY":
      return 7;
    case "BIWEEKLY":
      return 7;
    case "MONTHLY":
      return 14;
    default:
      return 7;
  }
}

/** Number of days in a given month (1-indexed). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Returns the due date for a specific cycle, centralizing all frequency logic.
 *
 * - DAILY:    startDate + (cycleIndex + 1) days
 * - WEEKLY:   preferred-day anchoring with 7-day intervals; falls back to
 *             raw 7-day intervals when no preferred day is set.
 * - BIWEEKLY: startDate + (cycleIndex + 1) * 14 days (no preferred-day anchoring)
 * - MONTHLY:  addMonths(startDate, cycleIndex + 1), day-of-month clamped to month length
 */
export function getDueDateForCycle(
  startDate: Date,
  cycleIndex: number,
  paymentFrequency: string,
  preferredPaymentDay?: string | null
): Date {
  const start = new Date(startDate);
  const periods = cycleIndex + 1;

  switch (paymentFrequency) {
    case "DAILY":
      return new Date(start.getTime() + periods * MS_PER_DAY);

    case "WEEKLY": {
      if (preferredPaymentDay && dayOfWeekToNumber(preferredPaymentDay) >= 0) {
        const gap = daysToFirstPreferredDay(start, preferredPaymentDay);
        return new Date(start.getTime() + (gap + cycleIndex * 7) * MS_PER_DAY);
      }
      return new Date(start.getTime() + periods * 7 * MS_PER_DAY);
    }

    case "BIWEEKLY":
      return new Date(start.getTime() + periods * 14 * MS_PER_DAY);

    case "MONTHLY": {
      const startYear = start.getUTCFullYear();
      const startMonth = start.getUTCMonth();
      const startDay = start.getUTCDate();

      const targetMonth = startMonth + periods;
      const targetYear = startYear + Math.floor(targetMonth / 12);
      const targetMonthNorm = targetMonth % 12;

      const maxDay = daysInMonth(targetYear, targetMonthNorm + 1);
      const day = Math.min(startDay, maxDay);

      return new Date(Date.UTC(targetYear, targetMonthNorm, day));
    }

    default:
      return new Date(start.getTime() + periods * 7 * MS_PER_DAY);
  }
}

/**
 * Count months elapsed from startDate to asOfDate for MONTHLY loans.
 * A cycle is counted once asOf reaches the start's day-of-month (clamped)
 * in a given month.
 */
function monthlyElapsed(startDate: Date, asOfDate: Date): number {
  const startYear = startDate.getUTCFullYear();
  const startMonth = startDate.getUTCMonth();
  const startDay = startDate.getUTCDate();

  const asOfYear = asOfDate.getUTCFullYear();
  const asOfMonth = asOfDate.getUTCMonth();
  const asOfDay = asOfDate.getUTCDate();

  let months = (asOfYear - startYear) * 12 + (asOfMonth - startMonth);

  if (months <= 0) return 0;

  const maxDayInAsOfMonth = daysInMonth(asOfYear, asOfMonth + 1);
  const dueDayThisMonth = Math.min(startDay, maxDayInAsOfMonth);

  if (asOfDay < dueDayThisMonth) {
    months--;
  }

  return Math.max(0, months);
}

/**
 * Cuotas covered by a set of installment payments, counted by money.
 * floor(sum of amounts / cuota) with a small epsilon so exact multiples
 * are not lost to floating-point error. Exported so receipts and other
 * derived views count progress identically to cycle metrics.
 */
export function countCuotasCovered(totalInstallmentPaid: number, cuota: number): number {
  if (cuota <= 0) return 0;
  return Math.max(0, Math.floor(totalInstallmentPaid / cuota + 1e-6));
}

/**
 * Payments made as of a date. Money-based when the data allows it (see
 * `LoanPaymentData.payments` doc); otherwise falls back to counting
 * COMPLETED rows. REVERSED and PENDING rows never count in money mode.
 */
function countPaymentsMade(loan: LoanPaymentData, asOf: Date): number {
  const cuota = loan.paymentAmount ?? 0;
  // Keep unless strictly after asOf — matches the historical filter, which
  // also kept rows whose paidAt fails to parse (NaN compares false both ways).
  const onOrBefore = loan.payments.filter((p) => !(new Date(p.paidAt) > asOf));

  const moneyMode = cuota > 0 && onOrBefore.every((p) => typeof p.amount === "number");
  if (moneyMode) {
    const total = onOrBefore
      .filter((p) => p.status === undefined || p.status === "COMPLETED" || p.status === "PARTIAL")
      .reduce((sum, p) => sum + (p.amount as number), 0);
    const covered = countCuotasCovered(total, cuota);
    const term = loan.termLength;
    return term !== undefined && term > 0 ? Math.min(covered, term) : covered;
  }

  return onOrBefore.filter((p) => p.status === undefined || p.status === "COMPLETED").length;
}

/**
 * Compute cycle metrics for a loan as of a given date.
 * Payments with paidAt after asOfDate are not counted.
 *
 * Uses loan.startingDate (if set) as the cycle anchor, otherwise createdAt.
 *
 * For WEEKLY loans with a preferredPaymentDay the first due date is the
 * first occurrence of that day after the anchor date (a grace period so the
 * customer gets until their preferred day). All subsequent due dates follow
 * every 7 days from there, keeping cycles permanently synced.
 *
 * For BIWEEKLY loans, cycles are fixed 14-day intervals from the anchor.
 *
 * For MONTHLY loans, cycle counting uses calendar month arithmetic;
 * day-of-month is clamped for short months.
 *
 * @param loan - Loan data
 * @param asOfDate - Defaults to now
 */
export function getCycleMetrics(loan: LoanPaymentData, asOfDate: Date = new Date()): CycleMetrics {
  const intervalDays = getIntervalDays(loan.paymentFrequency);
  const loanStart = new Date(loan.startingDate ?? loan.createdAt);
  const asOf = new Date(asOfDate);

  const msSinceLoan = asOf.getTime() - loanStart.getTime();
  const daysSinceLoan = Math.floor(msSinceLoan / MS_PER_DAY);

  let cyclesElapsed: number;

  if (loan.paymentFrequency === "MONTHLY") {
    cyclesElapsed = monthlyElapsed(loanStart, asOf);
  } else if (
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

  const term = loan.termLength;
  const paymentsMade = countPaymentsMade(loan, asOf);
  const cappedCycles =
    term !== undefined && term > 0 ? Math.min(cyclesElapsed, term) : cyclesElapsed;
  const missedCycles = Math.max(0, cappedCycles - paymentsMade);

  return {
    intervalDays,
    cyclesElapsed: cappedCycles,
    paymentsMade,
    missedCycles
  };
}
