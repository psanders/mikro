/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Money-based cycle counting: partial payments accumulate toward completed
 * cuotas. Guards against the historical bug where only individually-COMPLETED
 * rows advanced the cycle, freezing receipts and over-accruing mora.
 */
import { expect } from "chai";
import { getCycleMetrics, countCuotasCovered, type LoanPaymentData } from "@mikro/common";

const CUOTA = 1200;

function weeklyLoan(
  payments: LoanPaymentData["payments"],
  overrides: Partial<LoanPaymentData> = {}
): LoanPaymentData {
  return {
    paymentFrequency: "WEEKLY",
    createdAt: new Date("2026-05-04T00:00:00.000Z"),
    startingDate: new Date("2026-05-04T00:00:00.000Z"),
    termLength: 11,
    paymentAmount: CUOTA,
    preferredPaymentDay: "MONDAY",
    payments,
    ...overrides
  };
}

describe("countCuotasCovered", () => {
  it("counts whole cuotas only", () => {
    expect(countCuotasCovered(0, CUOTA)).to.equal(0);
    expect(countCuotasCovered(1199.99, CUOTA)).to.equal(0);
    expect(countCuotasCovered(1200, CUOTA)).to.equal(1);
    expect(countCuotasCovered(11944, CUOTA)).to.equal(9);
  });

  it("tolerates floating-point error on exact multiples", () => {
    expect(countCuotasCovered(1199.9999999, CUOTA)).to.equal(1);
    expect(countCuotasCovered(0.1 + 0.2 + 1199.7, CUOTA)).to.equal(1);
  });

  it("returns 0 for a non-positive cuota", () => {
    expect(countCuotasCovered(5000, 0)).to.equal(0);
    expect(countCuotasCovered(-100, CUOTA)).to.equal(0);
  });
});

describe("getCycleMetrics money-based counting", () => {
  it("accumulates PARTIAL payments into completed cuotas", () => {
    const loan = weeklyLoan([
      { paidAt: new Date("2026-05-11T12:00:00Z"), status: "PARTIAL", amount: 600 },
      { paidAt: new Date("2026-05-12T12:00:00Z"), status: "PARTIAL", amount: 600 }
    ]);
    const m = getCycleMetrics(loan, new Date("2026-05-13T00:00:00Z"));
    expect(m.paymentsMade).to.equal(1);
    expect(m.missedCycles).to.equal(0);
  });

  it("a full-cuota handover shaved by mora still completes the cuota once the rest arrives", () => {
    // 1,196 PARTIAL (mora took 4 off a 1,200 handover) + 4 more later
    const loan = weeklyLoan([
      { paidAt: new Date("2026-05-11T12:00:00Z"), status: "PARTIAL", amount: 1196 },
      { paidAt: new Date("2026-05-12T12:00:00Z"), status: "PARTIAL", amount: 4 }
    ]);
    const m = getCycleMetrics(loan, new Date("2026-05-13T00:00:00Z"));
    expect(m.paymentsMade).to.equal(1);
    expect(m.missedCycles).to.equal(0);
  });

  it("excludes PENDING and REVERSED rows from the money sum", () => {
    const loan = weeklyLoan([
      { paidAt: new Date("2026-05-11T12:00:00Z"), status: "COMPLETED", amount: 1200 },
      { paidAt: new Date("2026-05-11T13:00:00Z"), status: "REVERSED", amount: 1200 },
      { paidAt: new Date("2026-05-11T14:00:00Z"), status: "PENDING", amount: 1200 }
    ]);
    const m = getCycleMetrics(loan, new Date("2026-05-12T00:00:00Z"));
    expect(m.paymentsMade).to.equal(1);
  });

  it("ignores payments after asOf", () => {
    const loan = weeklyLoan([
      { paidAt: new Date("2026-05-11T12:00:00Z"), status: "COMPLETED", amount: 1200 },
      { paidAt: new Date("2026-05-18T12:00:00Z"), status: "COMPLETED", amount: 1200 }
    ]);
    const m = getCycleMetrics(loan, new Date("2026-05-12T00:00:00Z"));
    expect(m.paymentsMade).to.equal(1);
  });

  it("caps money-based paymentsMade at termLength on overpayment", () => {
    const loan = weeklyLoan([
      { paidAt: new Date("2026-05-11T12:00:00Z"), status: "COMPLETED", amount: 11 * CUOTA + 500 }
    ]);
    const m = getCycleMetrics(loan, new Date("2026-05-12T00:00:00Z"));
    expect(m.paymentsMade).to.equal(11);
    expect(m.missedCycles).to.equal(0);
  });

  it("falls back to COMPLETED-row counting when any amount is missing", () => {
    const loan = weeklyLoan([
      { paidAt: new Date("2026-05-11T12:00:00Z"), status: "PARTIAL", amount: 600 },
      { paidAt: new Date("2026-05-12T12:00:00Z"), status: "PARTIAL" } // no amount
    ]);
    const m = getCycleMetrics(loan, new Date("2026-05-13T00:00:00Z"));
    // fallback: PARTIAL rows don't count
    expect(m.paymentsMade).to.equal(0);
  });

  it("falls back to COMPLETED-row counting when paymentAmount is absent", () => {
    const loan = weeklyLoan(
      [
        { paidAt: new Date("2026-05-11T12:00:00Z"), status: "COMPLETED", amount: 1200 },
        { paidAt: new Date("2026-05-12T12:00:00Z"), status: "PARTIAL", amount: 1200 }
      ],
      { paymentAmount: undefined }
    );
    const m = getCycleMetrics(loan, new Date("2026-05-13T00:00:00Z"));
    expect(m.paymentsMade).to.equal(1);
  });
});
