/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Tests for BIWEEKLY and MONTHLY cycle metrics: getDueDateForCycle,
 * getCycleMetrics, and getLateDaysThreshold.
 */
import { expect } from "chai";
import {
  getCycleMetrics,
  getDueDateForCycle,
  getLateDaysThreshold,
  type LoanPaymentData
} from "@mikro/common";

function createLoan(params: {
  createdAt: Date;
  paymentFrequency: string;
  payments: Array<{ paidAt: Date }>;
  preferredPaymentDay?: string | null;
  startingDate?: Date | null;
}): LoanPaymentData {
  return {
    paymentFrequency: params.paymentFrequency,
    createdAt: params.createdAt,
    payments: params.payments,
    preferredPaymentDay: params.preferredPaymentDay,
    startingDate: params.startingDate
  };
}

describe("getDueDateForCycle", () => {
  it("DAILY: cycleIndex 4 from Jan 1 returns Jan 6", () => {
    const start = new Date("2026-01-01");
    const result = getDueDateForCycle(start, 4, "DAILY");
    expect(result.toISOString().slice(0, 10)).to.equal("2026-01-06");
  });

  it("WEEKLY without preferred day: cycleIndex 0 from Jan 1 returns Jan 8", () => {
    const start = new Date("2026-01-01");
    const result = getDueDateForCycle(start, 0, "WEEKLY");
    expect(result.toISOString().slice(0, 10)).to.equal("2026-01-08");
  });

  it("BIWEEKLY: cycleIndex 0 from Jan 1 returns Jan 15", () => {
    const start = new Date("2026-01-01");
    const result = getDueDateForCycle(start, 0, "BIWEEKLY");
    expect(result.toISOString().slice(0, 10)).to.equal("2026-01-15");
  });

  it("BIWEEKLY: cycleIndex 2 from Jan 1 returns Feb 12", () => {
    const start = new Date("2026-01-01");
    const result = getDueDateForCycle(start, 2, "BIWEEKLY");
    expect(result.toISOString().slice(0, 10)).to.equal("2026-02-12");
  });

  it("MONTHLY: cycleIndex 0 from Jan 15 returns Feb 15", () => {
    const start = new Date("2026-01-15");
    const result = getDueDateForCycle(start, 0, "MONTHLY");
    expect(result.toISOString().slice(0, 10)).to.equal("2026-02-15");
  });

  it("MONTHLY: cycleIndex 1 from Jan 15 returns Mar 15", () => {
    const start = new Date("2026-01-15");
    const result = getDueDateForCycle(start, 1, "MONTHLY");
    expect(result.toISOString().slice(0, 10)).to.equal("2026-03-15");
  });

  it("MONTHLY edge: cycleIndex 0 from Jan 31 returns Feb 28 (clamped)", () => {
    const start = new Date("2026-01-31");
    const result = getDueDateForCycle(start, 0, "MONTHLY");
    expect(result.toISOString().slice(0, 10)).to.equal("2026-02-28");
  });

  it("MONTHLY edge: cycleIndex 1 from Jan 31 returns Mar 31", () => {
    const start = new Date("2026-01-31");
    const result = getDueDateForCycle(start, 1, "MONTHLY");
    expect(result.toISOString().slice(0, 10)).to.equal("2026-03-31");
  });

  it("MONTHLY edge: cycleIndex 0 from Jan 29 in leap year returns Feb 29", () => {
    // 2028 is a leap year
    const start = new Date("2028-01-29");
    const result = getDueDateForCycle(start, 0, "MONTHLY");
    expect(result.toISOString().slice(0, 10)).to.equal("2028-02-29");
  });
});

describe("getCycleMetrics BIWEEKLY", () => {
  it("should return 0 cycles on day 13", () => {
    const loan = createLoan({
      createdAt: new Date("2026-01-01"),
      paymentFrequency: "BIWEEKLY",
      payments: []
    });
    const metrics = getCycleMetrics(loan, new Date("2026-01-14"));
    expect(metrics.intervalDays).to.equal(14);
    expect(metrics.cyclesElapsed).to.equal(0);
  });

  it("should return 1 cycle on day 14", () => {
    const loan = createLoan({
      createdAt: new Date("2026-01-01"),
      paymentFrequency: "BIWEEKLY",
      payments: []
    });
    const metrics = getCycleMetrics(loan, new Date("2026-01-15"));
    expect(metrics.cyclesElapsed).to.equal(1);
    expect(metrics.missedCycles).to.equal(1);
  });

  it("should return 1 cycle on day 27", () => {
    const loan = createLoan({
      createdAt: new Date("2026-01-01"),
      paymentFrequency: "BIWEEKLY",
      payments: []
    });
    const metrics = getCycleMetrics(loan, new Date("2026-01-28"));
    expect(metrics.cyclesElapsed).to.equal(1);
  });

  it("should return 2 cycles on day 28", () => {
    const loan = createLoan({
      createdAt: new Date("2026-01-01"),
      paymentFrequency: "BIWEEKLY",
      payments: []
    });
    const metrics = getCycleMetrics(loan, new Date("2026-01-29"));
    expect(metrics.cyclesElapsed).to.equal(2);
    expect(metrics.missedCycles).to.equal(2);
  });

  it("should count missed correctly with 1 payment and 2 cycles", () => {
    const loan = createLoan({
      createdAt: new Date("2026-01-01"),
      paymentFrequency: "BIWEEKLY",
      payments: [{ paidAt: new Date("2026-01-15") }]
    });
    const metrics = getCycleMetrics(loan, new Date("2026-01-29"));
    expect(metrics.cyclesElapsed).to.equal(2);
    expect(metrics.paymentsMade).to.equal(1);
    expect(metrics.missedCycles).to.equal(1);
  });

  it("should use startingDate over createdAt", () => {
    const loan = createLoan({
      createdAt: new Date("2026-01-01"),
      startingDate: new Date("2026-01-10"),
      paymentFrequency: "BIWEEKLY",
      payments: []
    });
    // 14 days from Jan 10 = Jan 24. On Jan 23 (day 13 from startingDate), 0 cycles.
    const metrics = getCycleMetrics(loan, new Date("2026-01-23"));
    expect(metrics.cyclesElapsed).to.equal(0);
    // On Jan 24 (day 14), 1 cycle.
    const metrics2 = getCycleMetrics(loan, new Date("2026-01-24"));
    expect(metrics2.cyclesElapsed).to.equal(1);
  });
});

describe("getCycleMetrics MONTHLY", () => {
  it("should return 0 cycles before first month", () => {
    const loan = createLoan({
      createdAt: new Date("2026-01-15"),
      paymentFrequency: "MONTHLY",
      payments: []
    });
    const metrics = getCycleMetrics(loan, new Date("2026-02-14"));
    expect(metrics.cyclesElapsed).to.equal(0);
  });

  it("should return 1 cycle on the first monthly due date", () => {
    const loan = createLoan({
      createdAt: new Date("2026-01-15"),
      paymentFrequency: "MONTHLY",
      payments: []
    });
    const metrics = getCycleMetrics(loan, new Date("2026-02-15"));
    expect(metrics.cyclesElapsed).to.equal(1);
    expect(metrics.missedCycles).to.equal(1);
  });

  it("should return 2 cycles after two months", () => {
    const loan = createLoan({
      createdAt: new Date("2026-01-15"),
      paymentFrequency: "MONTHLY",
      payments: []
    });
    const metrics = getCycleMetrics(loan, new Date("2026-03-15"));
    expect(metrics.cyclesElapsed).to.equal(2);
    expect(metrics.missedCycles).to.equal(2);
  });

  it("should handle short month (Jan 31 -> Feb 28)", () => {
    const loan = createLoan({
      createdAt: new Date("2026-01-31"),
      paymentFrequency: "MONTHLY",
      payments: []
    });
    // Feb 28 is the clamped due date for cycle 0, so 1 cycle elapsed
    const metrics = getCycleMetrics(loan, new Date("2026-02-28"));
    expect(metrics.cyclesElapsed).to.equal(1);
  });

  it("should return 1 cycle on Mar 30 for Jan 31 start (not yet Mar 31)", () => {
    const loan = createLoan({
      createdAt: new Date("2026-01-31"),
      paymentFrequency: "MONTHLY",
      payments: []
    });
    const metrics = getCycleMetrics(loan, new Date("2026-03-30"));
    expect(metrics.cyclesElapsed).to.equal(1);
  });

  it("should return 2 cycles on Mar 31 for Jan 31 start", () => {
    const loan = createLoan({
      createdAt: new Date("2026-01-31"),
      paymentFrequency: "MONTHLY",
      payments: []
    });
    const metrics = getCycleMetrics(loan, new Date("2026-03-31"));
    expect(metrics.cyclesElapsed).to.equal(2);
  });

  it("should count missed correctly with payments", () => {
    const loan = createLoan({
      createdAt: new Date("2026-01-15"),
      paymentFrequency: "MONTHLY",
      payments: []
    });
    const metrics = getCycleMetrics(loan, new Date("2026-03-15"));
    expect(metrics.cyclesElapsed).to.equal(2);
    expect(metrics.paymentsMade).to.equal(0);
    expect(metrics.missedCycles).to.equal(2);
  });

  it("should use startingDate over createdAt", () => {
    const loan = createLoan({
      createdAt: new Date("2026-01-01"),
      startingDate: new Date("2026-01-20"),
      paymentFrequency: "MONTHLY",
      payments: []
    });
    // 1 month from Jan 20 = Feb 20. On Feb 19, 0 cycles.
    const metrics = getCycleMetrics(loan, new Date("2026-02-19"));
    expect(metrics.cyclesElapsed).to.equal(0);
    // On Feb 20, 1 cycle.
    const metrics2 = getCycleMetrics(loan, new Date("2026-02-20"));
    expect(metrics2.cyclesElapsed).to.equal(1);
  });
});

describe("getLateDaysThreshold", () => {
  it("should return 1 for DAILY", () => {
    expect(getLateDaysThreshold("DAILY")).to.equal(1);
  });

  it("should return 7 for WEEKLY", () => {
    expect(getLateDaysThreshold("WEEKLY")).to.equal(7);
  });

  it("should return 7 for BIWEEKLY", () => {
    expect(getLateDaysThreshold("BIWEEKLY")).to.equal(7);
  });

  it("should return 14 for MONTHLY", () => {
    expect(getLateDaysThreshold("MONTHLY")).to.equal(14);
  });
});
