/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  calculateLoanSchema,
  DEFAULT_ADJUSTMENT_PER_PERIOD,
  DEFAULT_MIN_RATE,
  DEFAULT_MAX_RATE,
  DEFAULT_OPTIONS_RANGE,
  DEFAULT_PAYMENT_ROUNDING_INCREMENT,
  type CalculateLoanInput,
  type PaymentFrequency
} from "@mikro/common";

export interface LoanOption {
  duration: number;
  paymentFrequency: PaymentFrequency;
  interestRate: number;
  totalInterest: number;
  totalRepay: number;
  paymentPerPeriod: number;
  isBase: boolean;
}

export interface CalculateLoanResult {
  principal: number;
  paymentFrequency: PaymentFrequency;
  baseDuration: number;
  baseInterestRate: number;
  adjustmentPerPeriod: number;
  minRate: number;
  maxRate: number;
  options: LoanOption[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundUpToIncrement(value: number, increment: number): number {
  return Math.ceil(value / increment) * increment;
}

/**
 * Creates a validated function to calculate loan options from a base interest
 * rate with configurable per-period adjustments.
 */
export function createCalculateLoan() {
  const fn = async (params: CalculateLoanInput): Promise<CalculateLoanResult> => {
    const adjustmentPerPeriod = params.adjustmentPerPeriod ?? DEFAULT_ADJUSTMENT_PER_PERIOD;
    const minRate = params.minRate ?? DEFAULT_MIN_RATE;
    const maxRate = params.maxRate ?? DEFAULT_MAX_RATE;
    const optionsRange = params.optionsRange ?? DEFAULT_OPTIONS_RANGE;

    if (minRate > maxRate) {
      throw new Error("minRate cannot be greater than maxRate");
    }

    const options: LoanOption[] = [];
    const startDuration = params.baseDuration - optionsRange;
    const endDuration = params.baseDuration + optionsRange;

    for (let duration = startDuration; duration <= endDuration; duration++) {
      if (duration < 1) {
        continue;
      }

      const diff = duration - params.baseDuration;
      const rawRate = params.interestRate + diff * adjustmentPerPeriod;
      const interestRate = clamp(rawRate, minRate, maxRate);
      const totalInterest = Number((params.principal * interestRate).toFixed(2));
      const totalRepay = Number((params.principal + totalInterest).toFixed(2));
      // Round up to collection-friendly amounts (multiples of 50, including 100).
      const paymentPerPeriod = roundUpToIncrement(
        totalRepay / duration,
        DEFAULT_PAYMENT_ROUNDING_INCREMENT
      );

      options.push({
        duration,
        paymentFrequency: params.paymentFrequency,
        interestRate: Number(interestRate.toFixed(4)),
        totalInterest,
        totalRepay,
        paymentPerPeriod,
        isBase: duration === params.baseDuration
      });
    }

    return {
      principal: params.principal,
      paymentFrequency: params.paymentFrequency,
      baseDuration: params.baseDuration,
      baseInterestRate: params.interestRate,
      adjustmentPerPeriod,
      minRate,
      maxRate,
      options
    };
  };

  return withErrorHandlingAndValidation(fn, calculateLoanSchema);
}
