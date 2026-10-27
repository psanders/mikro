/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Cycle metrics and loan payment data for report helpers (rating, trend, etc.).
 */
import type { PaymentFrequency } from "./calculateLoan.js";
import { getLoanDueDate } from "./dueDates.js";

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
  /** Customer's preferred payment day (e.g. "FRIDAY"). Informational only:
   *  it does not move installment due dates. */
  preferredPaymentDay?: string | null;
  /** Optional cycle anchor date. When set, all cycle calculations use this
   *  instead of createdAt. Defaults to createdAt when absent. */
  startingDate?: Date | null;
  /** First cuota's due date. When absent, it is derived from the anchor (see `resolveFirstDueDate`). */
  firstDueDate?: Date | null;
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

/**
 * Returns the due date for a specific cycle (0-based) of a loan anchored at
 * `startDate`. Thin wrapper over `getLoanDueDate`; callers that hold the loan
 * should call `getLoanDueDate` directly.
 *
 * @param preferredPaymentDay - ignored; kept so existing call sites compile
 */
export function getDueDateForCycle(
  startDate: Date,
  cycleIndex: number,
  paymentFrequency: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept so existing call sites compile
  _preferredPaymentDay?: string | null
): Date {
  return getLoanDueDate(
    {
      startingDate: startDate,
      createdAt: startDate,
      paymentFrequency: paymentFrequency as PaymentFrequency
    },
    cycleIndex
  );
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
 * Money still needed to bring the currently open cuota to full coverage.
 * Returns a whole cuota when nothing is carried over (no partial in flight).
 * Works in cents so a half-covered cuota is not lost to floating-point error.
 */
export function cuotaRemainingToClose(totalInstallmentPaid: number, cuota: number): number {
  if (cuota <= 0) return 0;
  const cuotaCents = Math.round(cuota * 100);
  const paidCents = Math.max(0, Math.round(totalInstallmentPaid * 100));
  const carried = paidCents % cuotaCents;
  return carried === 0 ? cuota : (cuotaCents - carried) / 100;
}

/**
 * Money the schedule says should have been paid by now but hasn't been —
 * the remainder on every cuota already due, partials accounted for.
 *
 * Cycles due = cuotas covered + cycles missed, so this stays correct whether the
 * customer is mid-cuota or several cycles behind. Returns 0 when up to date.
 */
export function amountPastDue(input: {
  totalInstallmentPaid: number;
  cuotasCovered: number;
  missedCycles: number;
  cuota: number;
}): number {
  const { totalInstallmentPaid, cuotasCovered, missedCycles, cuota } = input;
  if (cuota <= 0) return 0;
  const cyclesDue = Math.max(0, cuotasCovered + missedCycles);
  return Math.max(0, Number((cyclesDue * cuota - totalInstallmentPaid).toFixed(2)));
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
 * `cyclesElapsed` is the number of cuotas whose due date (`getLoanDueDate`)
 * is on or before asOf's UTC day, capped to the term when it is set.
 *
 * @param loan - Loan data
 * @param asOfDate - Defaults to now
 */
export function getCycleMetrics(loan: LoanPaymentData, asOfDate: Date = new Date()): CycleMetrics {
  const intervalDays = getIntervalDays(loan.paymentFrequency);
  const asOf = new Date(asOfDate);
  const asOfDay = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());

  const term = loan.termLength;
  const hasTerm = term !== undefined && term > 0;
  const dueFields = { ...loan, paymentFrequency: loan.paymentFrequency as PaymentFrequency };

  let cyclesElapsed = 0;
  while (
    (!hasTerm || cyclesElapsed < term) &&
    getLoanDueDate(dueFields, cyclesElapsed).getTime() <= asOfDay
  ) {
    cyclesElapsed++;
  }

  const paymentsMade = countPaymentsMade(loan, asOf);
  const missedCycles = Math.max(0, cyclesElapsed - paymentsMade);

  return {
    intervalDays,
    cyclesElapsed,
    paymentsMade,
    missedCycles
  };
}
