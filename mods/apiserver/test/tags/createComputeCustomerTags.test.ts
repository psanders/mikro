/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import type { LoansConfig } from "@mikro/common";
import {
  computeCustomerTags,
  type LoanForTagEngine
} from "../../src/tags/createComputeCustomerTags.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const defaultPolicy: LoansConfig = {
  defaultMoraRate: 0.1,
  moraGraceDays: 0,
  moraCapInCuotas: 1,
  moraMinDop: 0,
  moraStopOnDefault: false,
  moraEffectiveFrom: undefined
};

interface LoanFixtureInput {
  id?: string;
  status?: "ACTIVE" | "COMPLETED" | "DEFAULTED" | "CANCELLED";
  startingDate: Date;
  termLength?: number;
  paymentAmount?: number;
  completedPayments?: number;
  paymentFrequency?: "WEEKLY" | "MONTHLY";
}

/** WEEKLY loan (default), no preferredPaymentDay, so cycle 0 is due exactly 7 days after start. */
function makeLoan(input: LoanFixtureInput): LoanForTagEngine {
  const completed = input.completedPayments ?? 0;
  const payments = Array.from({ length: completed }, (_, i) => ({
    paidAt: new Date(input.startingDate.getTime() + (i + 1) * 7 * MS_PER_DAY),
    status: "COMPLETED",
    kind: "INSTALLMENT" as const,
    amount: 650
  }));
  return {
    id: input.id ?? "loan-1",
    loanId: 10000,
    type: "SAN",
    status: input.status ?? "ACTIVE",
    principal: 10000,
    termLength: input.termLength ?? 52,
    paymentAmount: input.paymentAmount ?? 650,
    paymentFrequency: input.paymentFrequency ?? "WEEKLY",
    startingDate: input.startingDate,
    nickname: null,
    moraRate: null,
    customerId: "customer-1",
    createdAt: input.startingDate,
    updatedAt: input.startingDate,
    customer: { preferredPaymentDay: null },
    payments
  };
}

/** asOf such that the oldest unpaid cycle (cycle 0, due start+7d) is exactly `daysLate` days past. */
function asOfForDaysLate(start: Date, daysLate: number): Date {
  return new Date(start.getTime() + 7 * MS_PER_DAY + daysLate * MS_PER_DAY);
}

describe("computeCustomerTags", () => {
  it("returns null/null when there are no loans", () => {
    const result = computeCustomerTags([], defaultPolicy);
    expect(result.statusTag).to.be.null;
    expect(result.dpdTag).to.be.null;
    expect(result.daysPastDue).to.equal(0);
    expect(result.missedInstallments).to.equal(0);
    expect(result.worstLoanId).to.be.null;
  });

  it("excludes CANCELLED loans entirely", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const cancelled = makeLoan({ status: "CANCELLED", startingDate: start });
    const result = computeCustomerTags([cancelled], defaultPolicy);
    expect(result.statusTag).to.be.null;
    expect(result.dpdTag).to.be.null;
    expect(result.worstLoanId).to.be.null;
  });

  it("tags a loan with no due cycle yet as status:new", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const asOf = new Date(start.getTime() + 1 * MS_PER_DAY); // before first due (start+7d)
    const loan = makeLoan({ startingDate: start });
    const result = computeCustomerTags([loan], defaultPolicy, asOf);
    expect(result.statusTag).to.equal("status:new");
    expect(result.dpdTag).to.be.null;
  });

  it("tags a fully-paid-through loan as status:current with no dpd", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const asOf = asOfForDaysLate(start, 0); // exactly at cycle-0 due date
    const loan = makeLoan({ startingDate: start, completedPayments: 1 });
    const result = computeCustomerTags([loan], defaultPolicy, asOf);
    expect(result.statusTag).to.equal("status:current");
    expect(result.dpdTag).to.be.null;
  });

  it("tags a loan inside the mora grace window as status:pre_mora", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const asOf = asOfForDaysLate(start, 3);
    const loan = makeLoan({ startingDate: start });
    const policy: LoansConfig = { ...defaultPolicy, moraGraceDays: 5 };
    const result = computeCustomerTags([loan], policy, asOf);
    expect(result.statusTag).to.equal("status:pre_mora");
    expect(result.dpdTag).to.be.null;
  });

  it("buckets exactly 8 days past due as dpd:8_30 (boundary)", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const asOf = asOfForDaysLate(start, 8);
    const loan = makeLoan({ startingDate: start });
    const result = computeCustomerTags([loan], defaultPolicy, asOf);
    expect(result.statusTag).to.equal("status:past_due");
    expect(result.dpdTag).to.equal("dpd:8_30");
    expect(result.daysPastDue).to.equal(8);
    expect(result.missedInstallments).to.equal(2);
    expect(result.worstLoanId).to.equal("loan-1");
  });

  it("tags >=180 days past due as status:written_off with dpd:180_plus", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const asOf = asOfForDaysLate(start, 200);
    const loan = makeLoan({ startingDate: start, termLength: 52 });
    const result = computeCustomerTags([loan], defaultPolicy, asOf);
    expect(result.statusTag).to.equal("status:written_off");
    expect(result.dpdTag).to.equal("dpd:180_plus");
  });

  it("trusts Loan.status === DEFAULTED regardless of days past due, with no dpd bucket", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const asOf = asOfForDaysLate(start, 5); // would otherwise be past_due, not defaulted
    const loan = makeLoan({ startingDate: start, status: "DEFAULTED" });
    const result = computeCustomerTags([loan], defaultPolicy, asOf);
    expect(result.statusTag).to.equal("status:defaulted");
    expect(result.dpdTag).to.be.null;
    // daysPastDue/missedInstallments stay real/informational even though the
    // status tag is ops-trusted rather than derived.
    expect(result.daysPastDue).to.equal(5);
    expect(result.missedInstallments).to.equal(1);
  });

  it("does not infer status:defaulted from a large DPD alone", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const asOf = asOfForDaysLate(start, 120);
    const loan = makeLoan({ startingDate: start, status: "ACTIVE" });
    const result = computeCustomerTags([loan], defaultPolicy, asOf);
    expect(result.statusTag).to.equal("status:past_due");
    expect(result.dpdTag).to.equal("dpd:91_180");
  });

  it("worst-loan: a 40-days-past-due loan outranks a current loan on the same customer", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const asOf = asOfForDaysLate(start, 40);

    const currentLoan = makeLoan({ id: "loan-current", startingDate: start, completedPayments: 6 });
    const pastDueLoan = makeLoan({ id: "loan-past-due", startingDate: start });

    const result = computeCustomerTags([currentLoan, pastDueLoan], defaultPolicy, asOf);
    expect(result.statusTag).to.equal("status:past_due");
    expect(result.dpdTag).to.equal("dpd:31_60");
  });

  it("worst-loan: defaulted outranks written_off and past_due", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const asOf = asOfForDaysLate(start, 200);

    const writtenOff = makeLoan({ id: "loan-written-off", startingDate: start });
    const defaulted = makeLoan({ id: "loan-defaulted", startingDate: start, status: "DEFAULTED" });

    const result = computeCustomerTags([writtenOff, defaulted], defaultPolicy, asOf);
    expect(result.statusTag).to.equal("status:defaulted");
    expect(result.dpdTag).to.be.null;
  });

  it("worst-loan: within past_due, the higher-DPD loan wins (tie-break)", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const asOf = asOfForDaysLate(start, 65);

    const loanA = makeLoan({ id: "loan-a", startingDate: start }); // 65 days late
    // loanB started later so it's only 20 days late as of the same asOf.
    const loanBStart = new Date(asOf.getTime() - 7 * MS_PER_DAY - 20 * MS_PER_DAY);
    const loanB = makeLoan({ id: "loan-b", startingDate: loanBStart, termLength: 52 });

    const result = computeCustomerTags([loanA, loanB], defaultPolicy, asOf);
    expect(result.statusTag).to.equal("status:past_due");
    expect(result.dpdTag).to.equal("dpd:61_90");
  });

  describe("due: pre-due reminder tags", () => {
    it("tags a status:new loan whose first installment is 6 days out as due:4_7", () => {
      const start = new Date("2026-01-01T00:00:00Z");
      const asOf = new Date(start.getTime() + 1 * MS_PER_DAY); // first due at start+7d → 6 days out
      const loan = makeLoan({ startingDate: start });
      const result = computeCustomerTags([loan], defaultPolicy, asOf);
      expect(result.statusTag).to.equal("status:new");
      expect(result.dueTag).to.equal("due:4_7");
    });

    it("tags a status:new loan whose first installment is 2 days out as due:1_3", () => {
      const start = new Date("2026-01-01T00:00:00Z");
      const asOf = new Date(start.getTime() + 5 * MS_PER_DAY); // first due at start+7d → 2 days out
      const loan = makeLoan({ startingDate: start });
      const result = computeCustomerTags([loan], defaultPolicy, asOf);
      expect(result.statusTag).to.equal("status:new");
      expect(result.dueTag).to.equal("due:1_3");
    });

    it("tags a not-yet-elapsed installment due today (same calendar day) as due:today", () => {
      const start = new Date("2026-01-01T12:00:00Z");
      // First due at start+7d (2026-01-08T12:00Z); asOf earlier that same day → cycle not yet elapsed.
      const asOf = new Date("2026-01-08T06:00:00Z");
      const loan = makeLoan({ startingDate: start });
      const result = computeCustomerTags([loan], defaultPolicy, asOf);
      expect(result.statusTag).to.equal("status:new");
      expect(result.dueTag).to.equal("due:today");
    });

    it("emits no due: tag when the soonest installment is more than 7 days out (MONTHLY)", () => {
      const start = new Date("2026-01-01T00:00:00Z");
      const asOf = new Date(start.getTime() + 5 * MS_PER_DAY); // first due ~1 month out
      const loan = makeLoan({ startingDate: start, paymentFrequency: "MONTHLY", termLength: 12 });
      const result = computeCustomerTags([loan], defaultPolicy, asOf);
      expect(result.statusTag).to.equal("status:new");
      expect(result.dueTag).to.be.null;
    });

    it("emits no due: tag for a MONTHLY current loan whose next installment is weeks out", () => {
      const start = new Date("2026-01-01T00:00:00Z");
      const asOf = new Date("2026-02-01T00:00:00Z"); // cycle-0 due date; cuota 1 paid → current
      const loan = makeLoan({
        startingDate: start,
        paymentFrequency: "MONTHLY",
        termLength: 12,
        completedPayments: 1
      });
      const result = computeCustomerTags([loan], defaultPolicy, asOf);
      expect(result.statusTag).to.equal("status:current");
      // Next unpaid installment (cuota 2) is due ~2026-03-01, i.e. weeks out → outside the window.
      expect(result.dueTag).to.be.null;
    });

    it("suppresses due: entirely when the customer is delinquent (collection flow owns them)", () => {
      const start = new Date("2026-01-01T00:00:00Z");
      const asOf = asOfForDaysLate(start, 40);
      // A current loan with an upcoming installment, plus a past-due loan that wins the status.
      const current = makeLoan({ id: "loan-current", startingDate: start, completedPayments: 6 });
      const pastDue = makeLoan({ id: "loan-past-due", startingDate: start });
      const result = computeCustomerTags([current, pastDue], defaultPolicy, asOf);
      expect(result.statusTag).to.equal("status:past_due");
      expect(result.dueTag).to.be.null;
    });

    it("drives due: from the soonest upcoming installment across several new/current loans", () => {
      const start = new Date("2026-01-01T00:00:00Z");
      const asOf = new Date(start.getTime() + 1 * MS_PER_DAY);
      // loanFar's first installment is 6 days out (due:4_7); loanNear's is 2 days out (due:1_3).
      const loanFar = makeLoan({ id: "loan-far", startingDate: start });
      const loanNear = makeLoan({
        id: "loan-near",
        startingDate: new Date(start.getTime() - 4 * MS_PER_DAY)
      });
      const result = computeCustomerTags([loanFar, loanNear], defaultPolicy, asOf);
      expect(result.statusTag).to.equal("status:new");
      expect(result.dueTag).to.equal("due:1_3");
    });
  });
});
