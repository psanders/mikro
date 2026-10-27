/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  calculateLoanSchema,
  priceLoanOptions,
  type CalculateLoanInput,
  type LoanOption,
  type LoanPricing,
  type CalculateLoanResult
} from "@mikro/common";

export type { LoanOption, CalculateLoanResult };

/**
 * Creates a validated function that prices loan options on the configured
 * curve (`loans.pricing`). `interestRate`, `adjustmentPerPeriod`, `minRate`
 * and `maxRate` from older clients are accepted and ignored.
 */
export function createCalculateLoan(pricing: LoanPricing) {
  const fn = async (
    params: CalculateLoanInput
  ): Promise<CalculateLoanResult & { pricing: LoanPricing }> => {
    return priceLoanOptions(
      {
        principal: params.principal,
        paymentFrequency: params.paymentFrequency,
        baseDuration: params.baseDuration,
        optionsRange: params.optionsRange
      },
      pricing
    );
  };

  return withErrorHandlingAndValidation(fn, calculateLoanSchema);
}
