/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Helpers for renewal candidates report: remaining installments, near-completion eligibility.
 */
import type { LoanPaymentData } from "./calculatePaymentStatus.js";
import { getCycleMetrics } from "./calculatePaymentStatus.js";
import { getPaymentRating } from "./customerReportHelpers.js";
import { DEFAULT_NEAR_COMPLETION_THRESHOLDS } from "../config.js";

/** Loan data with term length for remaining-installments math. */
export interface LoanPaymentDataWithTerm extends LoanPaymentData {
  termLength: number;
}

/** Result of evaluating a loan for the renewal candidates report. */
export interface RenewalCandidateMetrics {
  remainingInstallments: number;
  thresholdInstallments: number;
  isNearCompletion: boolean;
  paymentRating: 1 | 2 | 3 | 4 | 5;
}

/**
 * Returns the number of installments remaining (scheduled cycles not yet paid).
 * For COMPLETED loans, pass loan with payments already covering full term; result is 0.
 */
export function getRemainingInstallments(
  loan: LoanPaymentDataWithTerm,
  asOfDate: Date = new Date()
): number {
  const { paymentsMade } = getCycleMetrics(loan, asOfDate);
  return Math.max(0, loan.termLength - paymentsMade);
}

/**
 * Returns the configured max remaining installments for a frequency to be "near completion".
 * Uses thresholds from config when provided; otherwise built-in defaults.
 */
export function getNearCompletionThreshold(
  frequency: string,
  thresholds?: Record<string, number> | null
): number {
  const map =
    thresholds && Object.keys(thresholds).length > 0
      ? thresholds
      : DEFAULT_NEAR_COMPLETION_THRESHOLDS;
  return map[frequency] ?? DEFAULT_NEAR_COMPLETION_THRESHOLDS[frequency] ?? 2;
}

/**
 * True when remaining installments <= threshold for the loan's payment frequency.
 * COMPLETED loans (remaining === 0) are always near completion.
 */
export function isNearCompletion(
  loan: LoanPaymentDataWithTerm,
  thresholds: Record<string, number> | undefined | null,
  asOfDate: Date = new Date()
): boolean {
  const remaining = getRemainingInstallments(loan, asOfDate);
  const threshold = getNearCompletionThreshold(loan.paymentFrequency, thresholds);
  return remaining <= threshold;
}

/**
 * Returns remaining installments, threshold, near-completion flag, and payment rating
 * for use in the renewal candidates report and AI note context.
 */
export function getRenewalCandidateMetrics(
  loan: LoanPaymentDataWithTerm,
  thresholds: Record<string, number> | undefined | null,
  asOfDate: Date = new Date()
): RenewalCandidateMetrics {
  const remainingInstallments = getRemainingInstallments(loan, asOfDate);
  const thresholdInstallments = getNearCompletionThreshold(loan.paymentFrequency, thresholds);
  const isNearCompletionFlag = remainingInstallments <= thresholdInstallments;
  const paymentRating = getPaymentRating(loan, asOfDate);
  return {
    remainingInstallments,
    thresholdInstallments,
    isNearCompletion: isNearCompletionFlag,
    paymentRating
  };
}
