/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  calculateLoanSchema,
  calculateLoanOptions,
  type CalculateLoanInput,
  type LoanOption,
  type CalculateLoanResult
} from "@mikro/common";

export type { LoanOption, CalculateLoanResult };

/**
 * Creates a validated function to calculate loan options from a base interest
 * rate with configurable per-period adjustments.
 */
export function createCalculateLoan() {
  const fn = async (params: CalculateLoanInput): Promise<CalculateLoanResult> => {
    return calculateLoanOptions(params);
  };

  return withErrorHandlingAndValidation(fn, calculateLoanSchema);
}
