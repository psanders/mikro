/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { calculatePaymentStatus, type LoanPaymentData } from "@mikro/common";

describe("calculatePaymentStatus", () => {
  let clock: sinon.SinonFakeTimers;

  // Helper to create a loan with specific parameters
  function createLoan(params: {
    createdAt: Date;
    paymentFrequency: "DAILY" | "WEEKLY";
    paymentsCount: number;
  }): LoanPaymentData {
    return {
      paymentFrequency: params.paymentFrequency,
      createdAt: params.createdAt,
      payments: Array(params.paymentsCount).fill({ paidAt: new Date() })
    };
  }

  afterEach(() => {
    if (clock) clock.restore();
  });

  describe("WEEKLY loans", () => {
    it("should return AL DIA when payments match cycles elapsed", () => {
      // Loan created Jan 1, today is Jan 22 (3 weeks = 3 cycles)
      clock = sinon.useFakeTimers(new Date("2026-01-22"));

      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        paymentsCount: 3
      });

      expect(calculatePaymentStatus(loan)).to.equal("AL DIA");
    });

    it("should return AL DIA when payments exceed cycles (paid ahead)", () => {
      // Loan created Jan 1, today is Jan 15 (2 weeks = 2 cycles)
      clock = sinon.useFakeTimers(new Date("2026-01-15"));

      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        paymentsCount: 4 // Paid 4, only 2 cycles elapsed
      });

      expect(calculatePaymentStatus(loan)).to.equal("AL DIA");
    });

    it("should return ATRASADO when 1 cycle behind", () => {
      // Loan created Jan 1, today is Jan 22 (3 weeks = 3 cycles)
      clock = sinon.useFakeTimers(new Date("2026-01-22"));

      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        paymentsCount: 2 // Paid 2, 3 cycles elapsed = 1 behind
      });

      expect(calculatePaymentStatus(loan)).to.equal("ATRASADO");
    });

    it("should return MUY ATRASADO when 2 cycles behind", () => {
      // Loan created Jan 1, today is Jan 22 (3 weeks = 3 cycles)
      clock = sinon.useFakeTimers(new Date("2026-01-22"));

      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        paymentsCount: 1 // Paid 1, 3 cycles elapsed = 2 behind
      });

      expect(calculatePaymentStatus(loan)).to.equal("MUY ATRASADO");
    });

    it("should return MUY ATRASADO when many cycles behind", () => {
      // Loan created Jan 1, today is Feb 19 (7 weeks = 7 cycles)
      clock = sinon.useFakeTimers(new Date("2026-02-19"));

      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        paymentsCount: 0 // Paid 0, 7 cycles elapsed = 7 behind
      });

      expect(calculatePaymentStatus(loan)).to.equal("MUY ATRASADO");
    });

    it("should return AL DIA on day zero (same day as creation)", () => {
      clock = sinon.useFakeTimers(new Date("2026-01-01"));

      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        paymentsCount: 0 // No payments yet, 0 cycles elapsed
      });

      expect(calculatePaymentStatus(loan)).to.equal("AL DIA");
    });

    it("should return AL DIA within first cycle (before 7 days)", () => {
      // Day 6 - still within first cycle
      clock = sinon.useFakeTimers(new Date("2026-01-07"));

      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        paymentsCount: 0
      });

      expect(calculatePaymentStatus(loan)).to.equal("AL DIA");
    });
  });

  describe("DAILY loans", () => {
    it("should return AL DIA when payments match days elapsed", () => {
      // Loan created Jan 1, today is Jan 4 (3 days = 3 cycles)
      clock = sinon.useFakeTimers(new Date("2026-01-04"));

      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "DAILY",
        paymentsCount: 3
      });

      expect(calculatePaymentStatus(loan)).to.equal("AL DIA");
    });

    it("should return ATRASADO when 1 day behind", () => {
      // Loan created Jan 1, today is Jan 4 (3 days = 3 cycles)
      clock = sinon.useFakeTimers(new Date("2026-01-04"));

      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "DAILY",
        paymentsCount: 2 // Paid 2, 3 cycles = 1 behind
      });

      expect(calculatePaymentStatus(loan)).to.equal("ATRASADO");
    });

    it("should return MUY ATRASADO when 2+ days behind", () => {
      // Loan created Jan 1, today is Jan 6 (5 days = 5 cycles)
      clock = sinon.useFakeTimers(new Date("2026-01-06"));

      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "DAILY",
        paymentsCount: 2 // Paid 2, 5 cycles = 3 behind
      });

      expect(calculatePaymentStatus(loan)).to.equal("MUY ATRASADO");
    });

    it("should return AL DIA on creation day", () => {
      clock = sinon.useFakeTimers(new Date("2026-01-01"));

      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "DAILY",
        paymentsCount: 0
      });

      expect(calculatePaymentStatus(loan)).to.equal("AL DIA");
    });
  });

  describe("edge cases", () => {
    it("should handle partial days correctly (rounds down)", () => {
      // 6.5 days = 0 weeks (floor(6.5/7) = 0)
      clock = sinon.useFakeTimers(new Date("2026-01-07T12:00:00"));

      const loan = createLoan({
        createdAt: new Date("2026-01-01T00:00:00"),
        paymentFrequency: "WEEKLY",
        paymentsCount: 0
      });

      // 6.5 days / 7 = 0 cycles (floored)
      expect(calculatePaymentStatus(loan)).to.equal("AL DIA");
    });

    it("should handle timezone-agnostic dates", () => {
      // Using UTC dates
      clock = sinon.useFakeTimers(new Date("2026-01-15T00:00:00Z"));

      const loan = createLoan({
        createdAt: new Date("2026-01-01T00:00:00Z"),
        paymentFrequency: "WEEKLY",
        paymentsCount: 2
      });

      // 14 days = 2 cycles, 2 payments = AL DIA
      expect(calculatePaymentStatus(loan)).to.equal("AL DIA");
    });
  });
});
