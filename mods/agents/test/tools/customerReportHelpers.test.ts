/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import {
  getMissedPaymentsCount,
  getTimesLateInLookback,
  getTimesLateInLastWeeks,
  getLatenessTrend,
  getPaymentRating,
  getReportRowHighlight,
  formatPaymentFrequency,
  type LoanPaymentData
} from "@mikro/common";

describe("customerReportHelpers", () => {
  let clock: sinon.SinonFakeTimers;

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

  afterEach(() => {
    if (clock) clock.restore();
  });

  // =========================================================================
  // Existing DAILY/WEEKLY tests (regression guard -- must remain unchanged)
  // =========================================================================

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

  describe("getMissedPaymentsCount with preferredPaymentDay", () => {
    it("should give grace until the first preferred day", () => {
      const loan = createLoan({
        createdAt: new Date("2026-01-05"),
        paymentFrequency: "WEEKLY",
        payments: [],
        preferredPaymentDay: "FRIDAY"
      });
      expect(getMissedPaymentsCount(loan, new Date("2026-01-07"))).to.equal(0);
    });

    it("should count 1 cycle once the first preferred day passes", () => {
      const loan = createLoan({
        createdAt: new Date("2026-01-05"),
        paymentFrequency: "WEEKLY",
        payments: [],
        preferredPaymentDay: "FRIDAY"
      });
      expect(getMissedPaymentsCount(loan, new Date("2026-01-09"))).to.equal(1);
    });

    it("should stay synced to the preferred day for subsequent cycles", () => {
      const loan = createLoan({
        createdAt: new Date("2026-01-05"),
        paymentFrequency: "WEEKLY",
        payments: [
          { paidAt: new Date("2026-01-09") },
          { paidAt: new Date("2026-01-16") },
          { paidAt: new Date("2026-01-23") }
        ],
        preferredPaymentDay: "FRIDAY"
      });
      expect(getMissedPaymentsCount(loan, new Date("2026-01-22"))).to.equal(0);
      expect(getMissedPaymentsCount(loan, new Date("2026-01-23"))).to.equal(0);
    });

    it("should detect behind only after the preferred day each week", () => {
      const loan = createLoan({
        createdAt: new Date("2026-01-05"),
        paymentFrequency: "WEEKLY",
        payments: [{ paidAt: new Date("2026-01-09") }],
        preferredPaymentDay: "FRIDAY"
      });
      expect(getMissedPaymentsCount(loan, new Date("2026-01-15"))).to.equal(0);
      expect(getMissedPaymentsCount(loan, new Date("2026-01-16"))).to.equal(1);
    });

    it("should treat creation on preferred day as first due next week", () => {
      const loan = createLoan({
        createdAt: new Date("2026-01-09"),
        paymentFrequency: "WEEKLY",
        payments: [{ paidAt: new Date("2026-01-16") }],
        preferredPaymentDay: "FRIDAY"
      });
      expect(getMissedPaymentsCount(loan, new Date("2026-01-15"))).to.equal(0);
      expect(getMissedPaymentsCount(loan, new Date("2026-01-16"))).to.equal(0);
    });

    it("should not affect daily loans", () => {
      clock = sinon.useFakeTimers(new Date("2026-01-04"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "DAILY",
        payments: [{ paidAt: new Date("2026-01-02") }],
        preferredPaymentDay: "FRIDAY"
      });
      expect(getMissedPaymentsCount(loan)).to.equal(2);
    });

    it("should fall back to old behavior when preferredPaymentDay is null", () => {
      clock = sinon.useFakeTimers(new Date("2026-01-22"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: [{ paidAt: new Date("2026-01-08") }, { paidAt: new Date("2026-01-15") }],
        preferredPaymentDay: null
      });
      expect(getMissedPaymentsCount(loan)).to.equal(1);
    });
  });

  describe("getTimesLateInLookback", () => {
    it("should return 0 for daily loans", () => {
      clock = sinon.useFakeTimers(new Date("2026-01-22"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "DAILY",
        payments: Array(21)
          .fill(null)
          .map((_, i) => ({ paidAt: new Date(`2026-01-${String(i + 1).padStart(2, "0")}`) }))
      });
      expect(getTimesLateInLookback(loan, 12)).to.equal(0);
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
      expect(getTimesLateInLookback(loan, 12)).to.equal(0);
    });

    it("should count cycles paid more than 7 days after due", () => {
      clock = sinon.useFakeTimers(new Date("2026-01-29"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "WEEKLY",
        payments: [
          { paidAt: new Date("2026-01-20") },
          { paidAt: new Date("2026-01-22") },
          { paidAt: new Date("2026-01-25") }
        ]
      });
      expect(getTimesLateInLookback(loan, 12)).to.equal(1);
    });

    it("deprecated alias getTimesLateInLastWeeks still works", () => {
      clock = sinon.useFakeTimers(new Date("2026-01-22"));
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "DAILY",
        payments: []
      });
      expect(getTimesLateInLastWeeks(loan, 12)).to.equal(0);
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

  // =========================================================================
  // BIWEEKLY / MONTHLY tests
  // =========================================================================

  describe("getMissedPaymentsCount BIWEEKLY", () => {
    it("should return 0 when on time", () => {
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "BIWEEKLY",
        payments: [{ paidAt: new Date("2026-01-15") }]
      });
      expect(getMissedPaymentsCount(loan, new Date("2026-01-15"))).to.equal(0);
    });

    it("should return 1 when one cycle behind", () => {
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "BIWEEKLY",
        payments: []
      });
      expect(getMissedPaymentsCount(loan, new Date("2026-01-15"))).to.equal(1);
    });

    it("should use startingDate", () => {
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        startingDate: new Date("2026-01-10"),
        paymentFrequency: "BIWEEKLY",
        payments: []
      });
      expect(getMissedPaymentsCount(loan, new Date("2026-01-23"))).to.equal(0);
      expect(getMissedPaymentsCount(loan, new Date("2026-01-24"))).to.equal(1);
    });
  });

  describe("getMissedPaymentsCount MONTHLY", () => {
    it("should return 0 when on time", () => {
      const loan = createLoan({
        createdAt: new Date("2026-01-15"),
        paymentFrequency: "MONTHLY",
        payments: [{ paidAt: new Date("2026-02-15") }]
      });
      expect(getMissedPaymentsCount(loan, new Date("2026-02-15"))).to.equal(0);
    });

    it("should return 1 when one month behind", () => {
      const loan = createLoan({
        createdAt: new Date("2026-01-15"),
        paymentFrequency: "MONTHLY",
        payments: []
      });
      expect(getMissedPaymentsCount(loan, new Date("2026-02-15"))).to.equal(1);
    });

    it("should handle short month (Jan 31 start)", () => {
      const loan = createLoan({
        createdAt: new Date("2026-01-31"),
        paymentFrequency: "MONTHLY",
        payments: []
      });
      expect(getMissedPaymentsCount(loan, new Date("2026-02-28"))).to.equal(1);
    });
  });

  describe("getTimesLateInLookback BIWEEKLY", () => {
    it("should return 0 when payments on time", () => {
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "BIWEEKLY",
        payments: [{ paidAt: new Date("2026-01-15") }, { paidAt: new Date("2026-01-29") }]
      });
      expect(getTimesLateInLookback(loan, 12, new Date("2026-01-29"))).to.equal(0);
    });

    it("should count late payments (>7 days after due)", () => {
      // Due Jan 15, paid Jan 25 = 10 days late (>7 threshold for BIWEEKLY)
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "BIWEEKLY",
        payments: [{ paidAt: new Date("2026-01-25") }]
      });
      expect(getTimesLateInLookback(loan, 12, new Date("2026-01-29"))).to.equal(1);
    });
  });

  describe("getTimesLateInLookback MONTHLY", () => {
    it("should return 0 when payments on time", () => {
      const loan = createLoan({
        createdAt: new Date("2026-01-15"),
        paymentFrequency: "MONTHLY",
        payments: [{ paidAt: new Date("2026-02-15") }]
      });
      expect(getTimesLateInLookback(loan, 12, new Date("2026-03-14"))).to.equal(0);
    });

    it("should count late payments (>14 days after due for MONTHLY)", () => {
      // Due Feb 15, paid Mar 5 = 18 days late (>14 threshold for MONTHLY)
      const loan = createLoan({
        createdAt: new Date("2026-01-15"),
        paymentFrequency: "MONTHLY",
        payments: [{ paidAt: new Date("2026-03-05") }]
      });
      expect(getTimesLateInLookback(loan, 12, new Date("2026-03-15"))).to.equal(1);
    });
  });

  describe("getLatenessTrend BIWEEKLY", () => {
    it("should detect empeorando for biweekly loan with increasing missed", () => {
      // Created Jan 1. By Mar 25 (12 biweekly cycles = 168 days), 0 payments -> 12 missed.
      // 42 days ago (Feb 11) -> 2 cycles elapsed, 0 payments -> 2 missed. Now 5 missed. empeorando.
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "BIWEEKLY",
        payments: []
      });
      expect(getLatenessTrend(loan, new Date("2026-03-25"))).to.equal("empeorando");
    });
  });

  describe("getPaymentRating BIWEEKLY smoke", () => {
    it("should return 5 for on-time biweekly loan", () => {
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "BIWEEKLY",
        payments: [{ paidAt: new Date("2026-01-15") }, { paidAt: new Date("2026-01-29") }]
      });
      expect(getPaymentRating(loan, new Date("2026-01-29"))).to.equal(5);
    });

    it("should return 1 for severely behind biweekly loan", () => {
      const loan = createLoan({
        createdAt: new Date("2026-01-01"),
        paymentFrequency: "BIWEEKLY",
        payments: []
      });
      expect(getPaymentRating(loan, new Date("2026-03-01"))).to.equal(1);
    });
  });

  describe("getPaymentRating MONTHLY smoke", () => {
    it("should return 5 for on-time monthly loan", () => {
      const loan = createLoan({
        createdAt: new Date("2026-01-15"),
        paymentFrequency: "MONTHLY",
        payments: [{ paidAt: new Date("2026-02-15") }]
      });
      expect(getPaymentRating(loan, new Date("2026-02-15"))).to.equal(5);
    });

    it("should return 1 for severely behind monthly loan", () => {
      const loan = createLoan({
        createdAt: new Date("2026-01-15"),
        paymentFrequency: "MONTHLY",
        payments: []
      });
      expect(getPaymentRating(loan, new Date("2026-05-15"))).to.equal(1);
    });
  });

  describe("formatPaymentFrequency", () => {
    it("returns Diario for DAILY", () => {
      expect(formatPaymentFrequency("DAILY")).to.equal("Diario");
    });

    it("returns Semanal for WEEKLY", () => {
      expect(formatPaymentFrequency("WEEKLY")).to.equal("Semanal");
    });

    it("returns Quincenal for BIWEEKLY", () => {
      expect(formatPaymentFrequency("BIWEEKLY")).to.equal("Quincenal");
    });

    it("returns Mensual for MONTHLY", () => {
      expect(formatPaymentFrequency("MONTHLY")).to.equal("Mensual");
    });
  });
});
