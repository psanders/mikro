/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pure loan option calculator (shared by API and marketing site).
 */
import {
  DEFAULT_ADJUSTMENT_PER_PERIOD,
  DEFAULT_MIN_RATE,
  DEFAULT_MAX_RATE,
  DEFAULT_OPTIONS_RANGE,
  DEFAULT_PAYMENT_ROUNDING_INCREMENT
} from "./loanCalculatorConstants.js";

export type PaymentFrequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export interface LoanOption {
  duration: number;
  paymentFrequency: PaymentFrequency;
  interestRate: number;
  totalInterest: number;
  totalRepay: number;
  paymentPerPeriod: number;
  isBase: boolean;
}

export interface CalculateLoanParams {
  principal: number;
  interestRate: number;
  paymentFrequency: PaymentFrequency;
  baseDuration: number;
  adjustmentPerPeriod?: number;
  minRate?: number;
  maxRate?: number;
  optionsRange?: number;
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

/**
 * The price curve: total interest (share of principal, not annual) by loan
 * length in weeks. See README "Loan pricing".
 */
export interface LoanPricing {
  referenceRate: number;
  referenceWeeks: number;
  adjustmentPerWeek: number;
  minRate: number;
  maxRate: number;
}

/** 30% at 10 weeks, ±1.5% per week, clamped to 10%–60%. */
export const DEFAULT_LOAN_PRICING: LoanPricing = {
  referenceRate: 0.3,
  referenceWeeks: 10,
  adjustmentPerWeek: DEFAULT_ADJUSTMENT_PER_PERIOD,
  minRate: DEFAULT_MIN_RATE,
  maxRate: DEFAULT_MAX_RATE
};

/** Loan length in weeks of one payment period. Used only for pricing. */
export const WEEKS_PER_PERIOD: Record<PaymentFrequency, number> = {
  DAILY: 1 / 7,
  WEEKLY: 1,
  BIWEEKLY: 2,
  MONTHLY: 52 / 12
};

export interface PriceLoanParams {
  principal: number;
  paymentFrequency: PaymentFrequency;
  baseDuration: number;
  optionsRange?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundUpToIncrement(value: number, increment: number): number {
  return Math.ceil(value / increment) * increment;
}

function buildOption(
  principal: number,
  paymentFrequency: PaymentFrequency,
  duration: number,
  interestRate: number,
  isBase: boolean
): LoanOption {
  const totalInterest = Number((principal * interestRate).toFixed(2));
  const totalRepay = Number((principal + totalInterest).toFixed(2));
  const paymentPerPeriod = roundUpToIncrement(
    totalRepay / duration,
    DEFAULT_PAYMENT_ROUNDING_INCREMENT
  );

  return {
    duration,
    paymentFrequency,
    interestRate: Number(interestRate.toFixed(4)),
    totalInterest,
    totalRepay,
    paymentPerPeriod,
    isBase
  };
}

/**
 * Prices loan options on one curve by loan length in weeks. The base duration
 * only centers the list of options; it never changes a price.
 */
export function priceLoanOptions(
  params: PriceLoanParams,
  pricing: LoanPricing
): CalculateLoanResult & { pricing: LoanPricing } {
  const optionsRange = params.optionsRange ?? DEFAULT_OPTIONS_RANGE;
  const weeksPerPeriod = WEEKS_PER_PERIOD[params.paymentFrequency];

  const options: LoanOption[] = [];
  for (
    let duration = params.baseDuration - optionsRange;
    duration <= params.baseDuration + optionsRange;
    duration++
  ) {
    if (duration < 1) {
      continue;
    }

    const weeks = duration * weeksPerPeriod;
    const rawRate =
      pricing.referenceRate + (weeks - pricing.referenceWeeks) * pricing.adjustmentPerWeek;
    const interestRate = clamp(rawRate, pricing.minRate, pricing.maxRate);
    options.push(
      buildOption(
        params.principal,
        params.paymentFrequency,
        duration,
        interestRate,
        duration === params.baseDuration
      )
    );
  }

  return {
    principal: params.principal,
    paymentFrequency: params.paymentFrequency,
    baseDuration: params.baseDuration,
    baseInterestRate: options.find((o) => o.isBase)?.interestRate ?? pricing.referenceRate,
    adjustmentPerPeriod: pricing.adjustmentPerWeek * weeksPerPeriod,
    minRate: pricing.minRate,
    maxRate: pricing.maxRate,
    options,
    pricing
  };
}

/**
 * Calculates loan options from a base interest rate with per-period adjustments.
 * Same logic as createCalculateLoan in the apiserver.
 */
export function calculateLoanOptions(params: CalculateLoanParams): CalculateLoanResult {
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
    options.push(
      buildOption(
        params.principal,
        params.paymentFrequency,
        duration,
        interestRate,
        duration === params.baseDuration
      )
    );
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
}
