/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * One price curve by loan length in weeks (mikro/#388): the base duration only
 * centers the list of options, it never changes a price.
 */
import { expect } from "chai";
import {
  calculateLoanOptions,
  priceLoanOptions,
  DEFAULT_LOAN_PRICING,
  type LoanOption
} from "../../src/utils/calculateLoan.js";

type Row = [duration: number, rate: number, totalRepay: number, paymentPerPeriod: number];

function rows(options: LoanOption[]): Row[] {
  return options.map((o) => [o.duration, o.interestRate, o.totalRepay, o.paymentPerPeriod]);
}

const WEEKLY_CENTER_10: Row[] = [
  [7, 0.255, 12550, 1800],
  [8, 0.27, 12700, 1600],
  [9, 0.285, 12850, 1450],
  [10, 0.3, 13000, 1300],
  [11, 0.315, 13150, 1200],
  [12, 0.33, 13300, 1150],
  [13, 0.345, 13450, 1050]
];

describe("priceLoanOptions", () => {
  it("quotes RD$10,000 weekly centered at 10 on the default curve", () => {
    const result = priceLoanOptions(
      { principal: 10000, paymentFrequency: "WEEKLY", baseDuration: 10 },
      DEFAULT_LOAN_PRICING
    );

    expect(rows(result.options)).to.deep.equal(WEEKLY_CENTER_10);
    const base = result.options.find((o) => o.isBase)!;
    expect(base.duration).to.equal(10);
    expect(base.totalInterest).to.equal(3000);
    expect(result.baseInterestRate).to.equal(0.3);
    expect(result.adjustmentPerPeriod).to.equal(0.015);
    expect(result.minRate).to.equal(0.1);
    expect(result.maxRate).to.equal(0.6);
    expect(result.pricing).to.deep.equal(DEFAULT_LOAN_PRICING);
  });

  it("gives the same prices when centered at 9 instead of 10", () => {
    const result = priceLoanOptions(
      { principal: 10000, paymentFrequency: "WEEKLY", baseDuration: 9 },
      DEFAULT_LOAN_PRICING
    );

    expect(rows(result.options)).to.deep.equal([
      [6, 0.24, 12400, 2100],
      ...WEEKLY_CENTER_10.slice(0, 6)
    ]);
    expect(result.options.find((o) => o.isBase)!.duration).to.equal(9);
  });

  it("prices biweekly by weeks: 6 biweeks costs the same as 12 weeks", () => {
    const result = priceLoanOptions(
      { principal: 10000, paymentFrequency: "BIWEEKLY", baseDuration: 5 },
      DEFAULT_LOAN_PRICING
    );

    expect(rows(result.options)).to.deep.equal([
      [2, 0.21, 12100, 6050],
      [3, 0.24, 12400, 4150],
      [4, 0.27, 12700, 3200],
      [5, 0.3, 13000, 2600],
      [6, 0.33, 13300, 2250],
      [7, 0.36, 13600, 1950],
      [8, 0.39, 13900, 1750]
    ]);
    expect(result.adjustmentPerPeriod).to.equal(0.03);
  });

  it("clamps monthly quotes at the max rate", () => {
    const result = priceLoanOptions(
      { principal: 10000, paymentFrequency: "MONTHLY", baseDuration: 6 },
      DEFAULT_LOAN_PRICING
    );

    expect(result.options.map((o) => [o.duration, o.interestRate])).to.deep.equal([
      [3, 0.345],
      [4, 0.41],
      [5, 0.475],
      [6, 0.54],
      [7, 0.6],
      [8, 0.6],
      [9, 0.6]
    ]);
    expect(result.options.slice(4).map((o) => o.paymentPerPeriod)).to.deep.equal([
      2300, 2000, 1800
    ]);
  });

  it("clamps at the min rate with a steep adjustment", () => {
    const result = priceLoanOptions(
      { principal: 10000, paymentFrequency: "WEEKLY", baseDuration: 1 },
      { ...DEFAULT_LOAN_PRICING, adjustmentPerWeek: 0.05 }
    );

    expect(result.options.find((o) => o.duration === 1)!.interestRate).to.equal(0.1);
  });
});

describe("calculateLoanOptions (site simulator call)", () => {
  it("still quotes 10 weeks at 30% and 18 weeks at 42%", () => {
    const result = calculateLoanOptions({
      principal: 20000,
      interestRate: 0.36,
      paymentFrequency: "WEEKLY",
      baseDuration: 14,
      optionsRange: 4
    });

    expect(result.options.find((o) => o.duration === 10)!.interestRate).to.equal(0.3);
    expect(result.options.find((o) => o.duration === 18)!.interestRate).to.equal(0.42);
  });
});
