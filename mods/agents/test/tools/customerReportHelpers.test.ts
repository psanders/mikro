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

describe("customerReportHelpers", () => {
  let clock: sinon.SinonFakeTimers;

  function createLoan(params: {
    createdAt: Date;
    paymentFrequency: "DAILY" | "WEEKLY";
    payments: Array<{ paidAt: Date }>;
    preferredPaymentDay?: string | null;
  }): LoanPaymentData {
    return {
      paymentFrequency: params.paymentFrequency,
      createdAt: params.createdAt,
      payments: params.payments,
      preferredPaymentDay: params.preferredPaymentDay
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

  describe("getMissedPaymentsCount with preferredPaymentDay", () => {
    // Jan 5 2026 = Monday.  Preferred = FRIDAY → gap = 4.
    // Due dates: Fri Jan 9 (day 4), Fri Jan 16 (day 11), Fri Jan 23 (day 18).
    // Before the first Friday, cyclesElapsed = 0 (grace period).

    it("should give grace until the first preferred day", () => {
      // Loan created Mon Jan 5, preferred FRIDAY. No payments yet.
      // On Wed Jan 7 (day 2): before first Friday → cyclesElapsed = 0 → not behind.
      const loan = createLoan({
        createdAt: new Date("2026-01-05"),
        paymentFrequency: "WEEKLY",
        payments: [],
        preferredPaymentDay: "FRIDAY"
      });
      expect(getMissedPaymentsCount(loan, new Date("2026-01-07"))).to.equal(0);
    });

    it("should count 1 cycle once the first preferred day passes", () => {
      // Fri Jan 9 (day 4): gap=4, (4-4)/7=0 +1 = 1 cycle. 0 payments → missed 1.
      const loan = createLoan({
        createdAt: new Date("2026-01-05"),
        paymentFrequency: "WEEKLY",
        payments: [],
        preferredPaymentDay: "FRIDAY"
      });
      expect(getMissedPaymentsCount(loan, new Date("2026-01-09"))).to.equal(1);
    });

    it("should stay synced to the preferred day for subsequent cycles", () => {
      // Customer pays every Friday: Jan 9, Jan 16, Jan 23.
      // On Thu Jan 22 (day 17): (17-4)/7=1 +1 = 2 cycles, 2 payments → 0 missed.
      // On Fri Jan 23 (day 18): (18-4)/7=2 +1 = 3 cycles, 3 payments → 0 missed.
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
      // Customer paid once (Jan 9). By Thu Jan 15 (day 10): only 1 cycle elapsed → 0 missed.
      // By Fri Jan 16 (day 11): 2 cycles elapsed, 1 payment → 1 missed.
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
      // Created Fri Jan 9, preferred FRIDAY → gap = 7.
      // First due: Fri Jan 16 (day 7). Same as old behavior.
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
