/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Payment status calculation for loan payment tracking.
 */

/**
 * Loan data required for payment status calculation.
 */
export interface LoanPaymentData {
  paymentFrequency: string;
  createdAt: Date;
  payments: Array<{ paidAt: Date }>;
}

/**
 * Loan payment status based on cycle comparison.
 * - "AL DIA" - on time (no missed payments)
 * - "ATRASADO" - late (1 missed payment)
 * - "MUY ATRASADO" - very late (2+ missed payments)
 */
export type LoanPaymentStatus = "AL DIA" | "ATRASADO" | "MUY ATRASADO";

/**
 * Calculate payment status by comparing elapsed cycles since loan creation
 * against completed payments. For SAN-type loans with fixed intervals.
 *
 * @param loan - Loan data with payment frequency, creation date, and payments
 * @returns Payment status: "AL DIA" (on time), "ATRASADO" (1 behind), "MUY ATRASADO" (2+ behind)
 */
export function calculatePaymentStatus(loan: LoanPaymentData): LoanPaymentStatus {
  const intervalDays = loan.paymentFrequency === "DAILY" ? 1 : 7;
  const today = new Date();
  const loanStart = new Date(loan.createdAt);

  // Calculate elapsed cycles since loan creation
  const msSinceLoan = today.getTime() - loanStart.getTime();
  const daysSinceLoan = Math.floor(msSinceLoan / (1000 * 60 * 60 * 24));
  const cyclesElapsed = Math.floor(daysSinceLoan / intervalDays);

  // Count payments made
  const paymentsMade = loan.payments.length;

  const missedCycles = cyclesElapsed - paymentsMade;

  if (missedCycles <= 0) return "AL DIA";
  if (missedCycles === 1) return "ATRASADO";
  return "MUY ATRASADO";
}
