/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { calculateFromForm, type LoanCalculatorForm } from "../../src/utils/loanCalculatorForm.js";

const weekly: LoanCalculatorForm = {
  principal: "10,000",
  ratePercent: "30",
  paymentFrequency: "WEEKLY",
  baseDuration: "10"
};

describe("calculateFromForm", () => {
  it("returns the options for a weekly loan, base row marked", () => {
    const out = calculateFromForm(weekly);
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

  it("reads the rate as a percent", () => {
    const out = calculateFromForm({ ...weekly, ratePercent: "25.5" });
    if (!out.ok) throw new Error(out.message);
    expect(out.result.baseInterestRate).to.equal(0.255);
  });

  it("rejects an empty monto and computes nothing", () => {
    const out = calculateFromForm({ ...weekly, principal: "" });
    expect(out).to.deep.equal({
      ok: false,
      field: "principal",
      message: "Ingresa un monto mayor que cero."
    });
  });

  it("rejects a tasa above 100%", () => {
    const out = calculateFromForm({ ...weekly, ratePercent: "120" });
    expect(out.ok).to.be.false;
    expect(out).to.include({ field: "ratePercent" });
  });

  it("rejects a fractional or zero plazo", () => {
    for (const baseDuration of ["0", "2.5", "abc"]) {
      const out = calculateFromForm({ ...weekly, baseDuration });
      expect(out, baseDuration).to.include({ ok: false, field: "baseDuration" });
    }
  });
});
