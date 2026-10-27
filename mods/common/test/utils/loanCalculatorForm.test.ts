/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { DEFAULT_LOAN_PRICING, type LoanPricing } from "../../src/utils/calculateLoan.js";
import {
  calculateFromForm,
  parseLoanCalculatorForm,
  type LoanCalculatorForm
} from "../../src/utils/loanCalculatorForm.js";

const weekly: LoanCalculatorForm = {
  principal: "10,000",
  paymentFrequency: "WEEKLY",
  baseDuration: "10"
};

const pricing: LoanPricing = { ...DEFAULT_LOAN_PRICING };

describe("calculateFromForm", () => {
  it("returns the options for a weekly loan, base row marked", () => {
    const out = calculateFromForm(weekly, pricing);
    if (!out.ok) throw new Error(out.message);

    expect(out.result.options.map((o) => o.duration)).to.deep.equal([7, 8, 9, 10, 11, 12, 13]);
    const base = out.result.options.find((o) => o.isBase)!;
    expect(base).to.include({
      duration: 10,
      interestRate: 0.3,
      totalInterest: 3000,
      totalRepay: 13000,
      paymentPerPeriod: 1300
    });
  });

  it("prices on the curve, so the base only centers the rows", () => {
    const out = calculateFromForm({ ...weekly, baseDuration: "9" }, pricing);
    if (!out.ok) throw new Error(out.message);

    const base = out.result.options.find((o) => o.isBase)!;
    expect(base).to.include({ duration: 9, interestRate: 0.285, paymentPerPeriod: 1450 });
    const ten = out.result.options.find((o) => o.duration === 10)!;
    expect(ten).to.include({ isBase: false, interestRate: 0.3, paymentPerPeriod: 1300 });
  });

  it("prices from the pricing it is given", () => {
    const out = calculateFromForm(weekly, { ...pricing, referenceRate: 0.25 });
    if (!out.ok) throw new Error(out.message);
    expect(out.result.baseInterestRate).to.equal(0.25);
  });

  it("rejects an empty monto and computes nothing", () => {
    const out = calculateFromForm({ ...weekly, principal: "" }, pricing);
    expect(out).to.deep.equal({
      ok: false,
      field: "principal",
      message: "Ingresa un monto mayor que cero."
    });
  });

  it("returns an error instead of throwing on an infinite monto", () => {
    const out = calculateFromForm({ ...weekly, principal: "1e999" }, pricing);
    expect(out).to.include({ ok: false, field: "principal" });
  });

  it("checks the fields without pricing", () => {
    expect(parseLoanCalculatorForm({ ...weekly, principal: "" })).to.include({
      ok: false,
      field: "principal"
    });
    expect(parseLoanCalculatorForm(weekly)).to.deep.equal({
      ok: true,
      params: { principal: 10000, paymentFrequency: "WEEKLY", baseDuration: 10 }
    });
  });

  it("rejects a fractional or zero plazo", () => {
    for (const baseDuration of ["0", "2.5", "abc"]) {
      const out = calculateFromForm({ ...weekly, baseDuration }, pricing);
      expect(out, baseDuration).to.include({ ok: false, field: "baseDuration" });
    }
  });
});
