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
}

export interface CycleMetrics {
  intervalDays: number;
  cyclesElapsed: number;
  paymentsMade: number;
  missedCycles: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Compute cycle metrics for a loan as of a given date.
 * Payments with paidAt after asOfDate are not counted.
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
  const cyclesElapsed = Math.max(0, Math.floor(daysSinceLoan / intervalDays));

  const paymentsMade = loan.payments.filter((p) => new Date(p.paidAt) <= asOf).length;
  const missedCycles = cyclesElapsed - paymentsMade;

  return { intervalDays, cyclesElapsed, paymentsMade, missedCycles };
}
