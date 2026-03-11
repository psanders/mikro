/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import {
  getRemainingInstallments,
  getNearCompletionThreshold,
  isNearCompletion,
  getRenewalCandidateMetrics,
  DEFAULT_NEAR_COMPLETION_THRESHOLDS
} from "@mikro/common";

describe("renewal report helpers", () => {
  const baseLoan = {
    paymentFrequency: "WEEKLY",
    createdAt: new Date("2025-01-01"),
    startingDate: null as Date | null,
    payments: [
      { paidAt: new Date("2025-01-08") },
      { paidAt: new Date("2025-01-15") },
      { paidAt: new Date("2025-01-22") }
    ],
    preferredPaymentDay: "WEDNESDAY" as string | null
  };

  describe("getRemainingInstallments", () => {
    it("returns termLength minus paymentsMade for active loan", () => {
      const loan = { ...baseLoan, termLength: 8 };
      const remaining = getRemainingInstallments(loan, new Date("2025-01-25"));
      expect(remaining).to.equal(5);
    });

    it("returns 0 when paymentsMade equals termLength (completed)", () => {
      const loan = {
        ...baseLoan,
        termLength: 3,
        payments: [
          { paidAt: new Date("2025-01-08") },
          { paidAt: new Date("2025-01-15") },
          { paidAt: new Date("2025-01-22") }
        ]
      };
      const remaining = getRemainingInstallments(loan, new Date("2025-01-25"));
      expect(remaining).to.equal(0);
    });

    it("returns 0 when no payments and asOf before first due still gives 0 remaining for 0 paymentsMade", () => {
      const loan = {
        ...baseLoan,
        termLength: 4,
        payments: []
      };
      const remaining = getRemainingInstallments(loan, new Date("2025-01-02"));
      expect(remaining).to.equal(4);
    });
  });

  describe("getNearCompletionThreshold", () => {
    it("returns default for WEEKLY when no config", () => {
      expect(getNearCompletionThreshold("WEEKLY", undefined)).to.equal(2);
      expect(getNearCompletionThreshold("WEEKLY", null)).to.equal(2);
    });

    it("returns default for DAILY, BIWEEKLY, MONTHLY", () => {
      expect(getNearCompletionThreshold("DAILY")).to.equal(
        DEFAULT_NEAR_COMPLETION_THRESHOLDS.DAILY
      );
      expect(getNearCompletionThreshold("BIWEEKLY")).to.equal(
        DEFAULT_NEAR_COMPLETION_THRESHOLDS.BIWEEKLY
      );
      expect(getNearCompletionThreshold("MONTHLY")).to.equal(
        DEFAULT_NEAR_COMPLETION_THRESHOLDS.MONTHLY
      );
    });

    it("uses custom thresholds when provided", () => {
      expect(getNearCompletionThreshold("WEEKLY", { WEEKLY: 3 })).to.equal(3);
      expect(getNearCompletionThreshold("DAILY", { DAILY: 7 })).to.equal(7);
    });
  });

  describe("isNearCompletion", () => {
    it("returns true when remaining <= threshold for frequency", () => {
      const loan = { ...baseLoan, termLength: 8 };
      const asOf = new Date("2025-01-25");
      expect(getRemainingInstallments(loan, asOf)).to.equal(5);
      expect(isNearCompletion(loan, undefined, asOf)).to.be.false;

      const loanNearEnd = {
        ...baseLoan,
        termLength: 5,
        payments: [
          { paidAt: new Date("2025-01-08") },
          { paidAt: new Date("2025-01-15") },
          { paidAt: new Date("2025-01-22") }
        ]
      };
      expect(getRemainingInstallments(loanNearEnd, asOf)).to.equal(2);
      expect(isNearCompletion(loanNearEnd, undefined, asOf)).to.be.true;
    });

    it("returns true for completed loan (remaining 0)", () => {
      const loan = {
        ...baseLoan,
        termLength: 3,
        payments: [
          { paidAt: new Date("2025-01-08") },
          { paidAt: new Date("2025-01-15") },
          { paidAt: new Date("2025-01-22") }
        ]
      };
      expect(isNearCompletion(loan, undefined, new Date("2025-01-25"))).to.be.true;
    });
  });

  describe("getRenewalCandidateMetrics", () => {
    it("returns remainingInstallments, threshold, isNearCompletion, and paymentRating", () => {
      const loan = { ...baseLoan, termLength: 5 };
      const asOf = new Date("2025-01-25");
      const m = getRenewalCandidateMetrics(loan, undefined, asOf);
      expect(m.remainingInstallments).to.equal(2);
      expect(m.thresholdInstallments).to.equal(2);
      expect(m.isNearCompletion).to.be.true;
      expect(m.paymentRating).to.be.within(1, 5);
    });
  });
});
