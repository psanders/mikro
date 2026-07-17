/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { computeAccruedMora, daysLateFromOldestDue, type LoanPaymentData } from "@mikro/common";

describe("computeAccruedMora", () => {
  const baseLoanData = (): LoanPaymentData => ({
    paymentFrequency: "WEEKLY",
    createdAt: new Date("2026-01-01T12:00:00Z"),
    startingDate: null,
    termLength: 10,
    payments: [],
    preferredPaymentDay: null
  });

  const policy = {
    moraGraceDays: 0,
    moraCapInCuotas: 1,
    moraMinDop: 0,
    moraStopOnDefault: false,
    moraEffectiveFrom: undefined as string | null | undefined
  };

  function makeInput(overrides: Record<string, unknown> = {}) {
    return {
      loanData: baseLoanData(),
      moraRate: 0.1,
      paymentAmount: 650,
      paymentFrequency: "WEEKLY",
      preferredPaymentDay: null,
      loanStart: new Date("2026-01-01T12:00:00Z"),
      asOfDate: new Date("2026-01-31T12:00:00Z"),
      loanStatus: "ACTIVE" as const,
      policy: { ...policy },
      ...overrides
    };
  }

  it("returns zero when no missed cycles", () => {
    const loanData = baseLoanData();
    loanData.payments = Array.from({ length: 2 }, (_, i) => ({
      paidAt: new Date(`2026-01-${8 + i * 7}T12:00:00Z`),
      status: "COMPLETED" as const
    }));
    const r = computeAccruedMora(
      makeInput({
        loanData,
        asOfDate: new Date("2026-01-10T12:00:00Z")
      })
    );
    expect(r.moraAmount).to.equal(0);
    expect(r.missedCycles).to.equal(0);
  });

  it("matches prorated formula for one missed cycle (export script behavior)", () => {
    const r = computeAccruedMora(makeInput());
    expect(r.missedCycles).to.be.greaterThan(0);
    expect(r.daysLate).to.be.greaterThan(0);
    const expected = 0.1 * (r.daysLate / 30) * 650;
    expect(r.moraAmount).to.be.closeTo(expected, 0.02);
  });

  it("applies grace days", () => {
    const r = computeAccruedMora(
      makeInput({
        asOfDate: new Date("2026-01-20T12:00:00Z"),
        policy: { ...policy, moraGraceDays: 1000 }
      })
    );
    expect(r.graceApplied).to.be.true;
    expect(r.moraAmount).to.equal(0);
  });

  it("applies grace when daysLate equals moraGraceDays", () => {
    const r = computeAccruedMora(
      makeInput({
        asOfDate: new Date("2026-01-09T12:00:00Z"),
        policy: { ...policy, moraGraceDays: 1 }
      })
    );
    expect(r.daysLate).to.equal(1);
    expect(r.missedCycles).to.equal(1);
    expect(r.graceApplied).to.be.true;
    expect(r.moraAmount).to.equal(0);
  });

  it("accrues once daysLate passes moraGraceDays", () => {
    const r = computeAccruedMora(
      makeInput({
        asOfDate: new Date("2026-01-10T12:00:00Z"),
        policy: { ...policy, moraGraceDays: 1 }
      })
    );
    expect(r.daysLate).to.equal(2);
    expect(r.graceApplied).to.be.false;
    expect(r.moraAmount).to.be.greaterThan(0);
  });

  // Grace is a waiver window, not a deductible: once passed, mora bills every
  // elapsed day including the grace day itself.
  it("bills the grace day too once grace is passed", () => {
    const r = computeAccruedMora(
      makeInput({
        asOfDate: new Date("2026-01-10T12:00:00Z"),
        policy: { ...policy, moraGraceDays: 1 }
      })
    );
    expect(r.moraAmount).to.be.closeTo(0.1 * (2 / 30) * 650, 0.005);
    expect(r.moraAmount).to.not.be.closeTo(0.1 * (1 / 30) * 650, 0.005);
  });

  it("caps mora at moraCapInCuotas * paymentAmount", () => {
    const r = computeAccruedMora(
      makeInput({
        moraRate: 10,
        asOfDate: new Date("2026-06-01T12:00:00Z"),
        policy: { ...policy, moraCapInCuotas: 0.5 }
      })
    );
    expect(r.capApplied).to.be.true;
    expect(r.moraAmount).to.equal(325);
  });

  it("enforces moraMinDop floor", () => {
    const r = computeAccruedMora(
      makeInput({
        asOfDate: new Date("2026-01-10T12:00:00Z"),
        policy: { ...policy, moraMinDop: 500 }
      })
    );
    expect(r.moraAmount).to.equal(500);
  });

  it("returns zero when moraMinDop is set but there are no missed cycles", () => {
    const loanData = baseLoanData();
    loanData.payments = Array.from({ length: 5 }, (_, i) => ({
      paidAt: new Date(`2026-01-${8 + i * 7}T12:00:00Z`),
      status: "COMPLETED" as const
    }));
    const r = computeAccruedMora(
      makeInput({
        loanData,
        asOfDate: new Date("2026-01-10T12:00:00Z"),
        policy: { ...policy, moraMinDop: 500 }
      })
    );
    expect(r.moraAmount).to.equal(0);
  });

  it("stops accrual at loanUpdatedAt when moraStopOnDefault and loan is DEFAULTED", () => {
    const defaultedAt = new Date("2026-02-01T12:00:00Z");
    const r = computeAccruedMora(
      makeInput({
        loanStatus: "DEFAULTED",
        loanUpdatedAt: defaultedAt,
        asOfDate: new Date("2026-06-01T12:00:00Z"),
        policy: { ...policy, moraStopOnDefault: true }
      })
    );

    const rUncapped = computeAccruedMora(
      makeInput({
        loanStatus: "DEFAULTED",
        loanUpdatedAt: defaultedAt,
        asOfDate: new Date("2026-06-01T12:00:00Z"),
        policy: { ...policy, moraStopOnDefault: false }
      })
    );

    expect(r.moraAmount).to.be.lessThan(rUncapped.moraAmount);
    expect(r.daysLate).to.be.lessThan(rUncapped.daysLate);
  });

  it("shifts accrual start when moraEffectiveFrom is after oldest due date", () => {
    const rNoEffective = computeAccruedMora(
      makeInput({
        asOfDate: new Date("2026-03-01T12:00:00Z")
      })
    );

    const rWithEffective = computeAccruedMora(
      makeInput({
        asOfDate: new Date("2026-03-01T12:00:00Z"),
        policy: { ...policy, moraEffectiveFrom: "2026-02-15" }
      })
    );

    expect(rWithEffective.daysLate).to.be.lessThan(rNoEffective.daysLate);
    expect(rWithEffective.moraAmount).to.be.lessThan(rNoEffective.moraAmount);
  });

  it("ignores invalid moraEffectiveFrom strings", () => {
    const r1 = computeAccruedMora(makeInput());
    const r2 = computeAccruedMora(
      makeInput({
        policy: { ...policy, moraEffectiveFrom: "not-a-date" }
      })
    );
    expect(r1.moraAmount).to.equal(r2.moraAmount);
  });

  it("returns zero when moraRate is zero", () => {
    const r = computeAccruedMora(makeInput({ moraRate: 0 }));
    expect(r.moraAmount).to.equal(0);
  });

  it("returns zero when paymentAmount is zero", () => {
    const r = computeAccruedMora(makeInput({ paymentAmount: 0 }));
    expect(r.moraAmount).to.equal(0);
  });

  it("returns grossMoraAmount equal to moraAmount when no LATE_FEE collected", () => {
    const r = computeAccruedMora(makeInput());
    expect(r.grossMoraAmount).to.be.greaterThan(0);
    expect(r.collectedMora).to.equal(0);
    expect(r.moraAmount).to.equal(r.grossMoraAmount);
  });

  it("subtracts collected LATE_FEE paid on or after oldest missed due", () => {
    const asOf = new Date("2026-01-31T12:00:00Z");
    const rGross = computeAccruedMora(makeInput({ asOfDate: asOf }));
    expect(rGross.grossMoraAmount).to.be.greaterThan(0);

    const rNet = computeAccruedMora(
      makeInput({
        asOfDate: asOf,
        collectedLateFeePayments: [
          {
            paidAt: new Date("2026-01-20T12:00:00Z"),
            amount: rGross.grossMoraAmount,
            status: "COMPLETED"
          }
        ]
      })
    );
    expect(rNet.grossMoraAmount).to.equal(rGross.grossMoraAmount);
    expect(rNet.collectedMora).to.equal(rGross.grossMoraAmount);
    expect(rNet.moraAmount).to.equal(0);
  });

  it("ignores REVERSED LATE_FEE when netting", () => {
    const asOf = new Date("2026-01-31T12:00:00Z");
    const rGross = computeAccruedMora(makeInput({ asOfDate: asOf }));
    const rNet = computeAccruedMora(
      makeInput({
        asOfDate: asOf,
        collectedLateFeePayments: [
          { paidAt: new Date("2026-01-20T12:00:00Z"), amount: 500, status: "REVERSED" }
        ]
      })
    );
    expect(rNet.collectedMora).to.equal(0);
    expect(rNet.moraAmount).to.equal(rGross.grossMoraAmount);
  });

  it("ignores LATE_FEE paid before oldest missed due", () => {
    const asOf = new Date("2026-01-31T12:00:00Z");
    const rGross = computeAccruedMora(makeInput({ asOfDate: asOf }));
    const rNet = computeAccruedMora(
      makeInput({
        asOfDate: asOf,
        collectedLateFeePayments: [
          { paidAt: new Date("2025-12-01T12:00:00Z"), amount: 999, status: "COMPLETED" }
        ]
      })
    );
    expect(rNet.collectedMora).to.equal(0);
    expect(rNet.moraAmount).to.equal(rGross.grossMoraAmount);
  });

  it("clamps net mora to zero when collected exceeds gross", () => {
    const asOf = new Date("2026-01-31T12:00:00Z");
    const r = computeAccruedMora(
      makeInput({
        asOfDate: asOf,
        collectedLateFeePayments: [
          { paidAt: new Date("2026-01-20T12:00:00Z"), amount: 50_000, status: "COMPLETED" }
        ]
      })
    );
    expect(r.moraAmount).to.equal(0);
    expect(r.grossMoraAmount).to.be.greaterThan(0);
    expect(r.collectedMora).to.equal(50_000);
  });
});

describe("daysLateFromOldestDue", () => {
  it("returns 0 when missedCycles is 0", () => {
    const d = daysLateFromOldestDue(
      new Date("2026-01-01"),
      "WEEKLY",
      null,
      2,
      0,
      new Date("2026-01-20")
    );
    expect(d).to.equal(0);
  });

  it("returns calendar days from oldest due to asOf", () => {
    const d = daysLateFromOldestDue(
      new Date("2026-01-01T12:00:00Z"),
      "WEEKLY",
      null,
      0,
      1,
      new Date("2026-01-15T12:00:00Z")
    );
    expect(d).to.equal(7);
  });
});
