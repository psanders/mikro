/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import {
  getMissedPaymentsCount,
  getTimesLateInLastWeeks,
  getLatenessTrend,
  getPaymentRating,
  getReportRowHighlight,
  type LoanPaymentData
} from "@mikro/common";

describe("memberReportHelpers", () => {
  let clock: sinon.SinonFakeTimers;

  function createLoan(params: {
    createdAt: Date;
    paymentFrequency: "DAILY" | "WEEKLY";
    payments: Array<{ paidAt: Date }>;
  }): LoanPaymentData {
    return {
      paymentFrequency: params.paymentFrequency,
      createdAt: params.createdAt,
      payments: params.payments
    };
  }

  afterEach(() => {
    if (clock) clock.restore();
  });

  describe("getMissedPaymentsCount", () => {
    it("should return 0 when on time", () => {
      clock = sinon.useFakeTimers(new Date("2026-01-22"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: [
          { paidAt: new Date("2026-01-08") },
          { paidAt: new Date("2026-01-15") },
          { paidAt: new Date("2026-01-22") }
        ]
      });
      expect(getMissedPaymentsCount(loan)).to.equal(0);
    });

    it("should return 1 when one cycle behind", () => {
      clock = sinon.useFakeTimers(new Date("2026-01-22"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: [{ paidAt: new Date("2026-01-08") }, { paidAt: new Date("2026-01-15") }]
      });
      expect(getMissedPaymentsCount(loan)).to.equal(1);
    });

    it("should return 2+ when multiple cycles behind", () => {
      clock = sinon.useFakeTimers(new Date("2026-01-22"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: [{ paidAt: new Date("2026-01-08") }]
      });
      expect(getMissedPaymentsCount(loan)).to.equal(2);
    });

    it("should respect asOfDate", () => {
      clock = sinon.useFakeTimers(new Date("2026-02-12"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: [
          { paidAt: new Date("2026-01-08") },
          { paidAt: new Date("2026-01-29") },
          { paidAt: new Date("2026-02-05") },
          { paidAt: new Date("2026-02-10") },
          { paidAt: new Date("2026-02-11") }
        ]
      });
      const asOfPast = new Date("2026-01-22");
      expect(getMissedPaymentsCount(loan, asOfPast)).to.equal(2);
      expect(getMissedPaymentsCount(loan)).to.equal(1);
    });
  });

  describe("getTimesLateInLastWeeks", () => {
    it("should return 0 for daily loans", () => {
      clock = sinon.useFakeTimers(new Date("2026-01-22"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "DAILY",
        payments: Array(21)
          .fill(null)
          .map((_, i) => ({ paidAt: new Date(`2026-01-${String(i + 1).padStart(2, "0")}`) }))
      });
      expect(getTimesLateInLastWeeks(loan, 12)).to.equal(0);
    });

    it("should return 0 when all payments on time", () => {
      clock = sinon.useFakeTimers(new Date("2026-01-22"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: [
          { paidAt: new Date("2026-01-07") },
          { paidAt: new Date("2026-01-14") },
          { paidAt: new Date("2026-01-21") }
        ]
      });
      expect(getTimesLateInLastWeeks(loan, 12)).to.equal(0);
    });

    it("should count cycles paid more than 7 days after due", () => {
      clock = sinon.useFakeTimers(new Date("2026-01-29"));
      // Cycle 0 due Jan 8, paid Jan 20 = 12 days late. Cycle 1 due Jan 15, paid Jan 22 = 7 days late (not >7). Cycle 2 due Jan 22, paid Jan 25 = 3 days late.
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: [
          { paidAt: new Date("2026-01-20") },
          { paidAt: new Date("2026-01-22") },
          { paidAt: new Date("2026-01-25") }
        ]
      });
      expect(getTimesLateInLastWeeks(loan, 12)).to.equal(1);
    });
  });

  describe("getLatenessTrend", () => {
    it("should return mejorando when missed count decreased", () => {
      clock = sinon.useFakeTimers(new Date("2026-02-12"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: [
          { paidAt: new Date("2026-01-08") },
          { paidAt: new Date("2026-01-29") },
          { paidAt: new Date("2026-02-05") },
          { paidAt: new Date("2026-02-10") },
          { paidAt: new Date("2026-02-11") }
        ]
      });
      expect(getLatenessTrend(loan)).to.equal("mejorando");
    });

    it("should return estable when missed count unchanged", () => {
      clock = sinon.useFakeTimers(new Date("2026-02-05"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: [
          { paidAt: new Date("2026-01-22") },
          { paidAt: new Date("2026-01-29") },
          { paidAt: new Date("2026-02-05") }
        ]
      });
      expect(getLatenessTrend(loan)).to.equal("estable");
    });

    it("should return empeorando when missed count increased", () => {
      clock = sinon.useFakeTimers(new Date("2026-02-12"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: [
          { paidAt: new Date("2026-01-08") },
          { paidAt: new Date("2026-01-15") },
          { paidAt: new Date("2026-01-22") }
        ]
      });
      expect(getLatenessTrend(loan)).to.equal("empeorando");
    });
  });

  describe("getPaymentRating", () => {
    it("should return 5 for on time with good history", () => {
      clock = sinon.useFakeTimers(new Date("2026-01-22"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: [
          { paidAt: new Date("2026-01-07") },
          { paidAt: new Date("2026-01-14") },
          { paidAt: new Date("2026-01-21") }
        ]
      });
      expect(getPaymentRating(loan)).to.equal(5);
    });

    it("should return 4 for on time with one late in history", () => {
      clock = sinon.useFakeTimers(new Date("2026-02-05"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: [
          { paidAt: new Date("2026-01-20") },
          { paidAt: new Date("2026-01-22") },
          { paidAt: new Date("2026-01-29") },
          { paidAt: new Date("2026-02-02") },
          { paidAt: new Date("2026-02-05") }
        ]
      });
      expect(getPaymentRating(loan)).to.equal(4);
    });

    it("should return 3 for one missed", () => {
      clock = sinon.useFakeTimers(new Date("2026-01-22"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: [{ paidAt: new Date("2026-01-08") }, { paidAt: new Date("2026-01-15") }]
      });
      expect(getPaymentRating(loan)).to.equal(3);
    });

    it("should return 2 for two missed or chronically late", () => {
      clock = sinon.useFakeTimers(new Date("2026-02-05"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: [
          { paidAt: new Date("2026-01-22") },
          { paidAt: new Date("2026-01-29") },
          { paidAt: new Date("2026-02-05") }
        ]
      });
      expect(getPaymentRating(loan)).to.equal(2);
    });

    it("should return 1 for 3+ missed or deteriorating with 2+ missed", () => {
      clock = sinon.useFakeTimers(new Date("2026-01-22"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: []
      });
      expect(getPaymentRating(loan)).to.equal(1);
    });
  });

  describe("getReportRowHighlight", () => {
    it("should return null when on time", () => {
      clock = sinon.useFakeTimers(new Date("2026-01-22"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: [
          { paidAt: new Date("2026-01-08") },
          { paidAt: new Date("2026-01-15") },
          { paidAt: new Date("2026-01-22") }
        ]
      });
      expect(getReportRowHighlight(loan)).to.equal(null);
    });

    it("should return null when 1 missed and not chronically late", () => {
      clock = sinon.useFakeTimers(new Date("2026-01-22"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: [{ paidAt: new Date("2026-01-08") }, { paidAt: new Date("2026-01-15") }]
      });
      expect(getReportRowHighlight(loan)).to.equal(null);
    });

    it("should return yellow when 2 missed", () => {
      clock = sinon.useFakeTimers(new Date("2026-02-05"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: [
          { paidAt: new Date("2026-01-22") },
          { paidAt: new Date("2026-01-29") },
          { paidAt: new Date("2026-02-05") }
        ]
      });
      expect(getReportRowHighlight(loan)).to.equal("yellow");
    });

    it("should return red when 3+ missed", () => {
      clock = sinon.useFakeTimers(new Date("2026-01-29"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: []
      });
      expect(getReportRowHighlight(loan)).to.equal("red");
    });

    it("should return red when deteriorating with 2+ missed", () => {
      clock = sinon.useFakeTimers(new Date("2026-02-12"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: [
          { paidAt: new Date("2026-01-08") },
          { paidAt: new Date("2026-01-15") },
          { paidAt: new Date("2026-01-22") }
        ]
      });
      expect(getReportRowHighlight(loan)).to.equal("red");
    });
  });
});
