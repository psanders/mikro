/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { ValidationError } from "@mikro/common";
import { createGetRenewalQuote } from "../../src/api/loans/createGetRenewalQuote.js";

function loanRow(status: string, paid: number[]) {
  const start = new Date("2026-08-01T12:00:00Z");
  return {
    loanId: 10034,
    principal: 10000,
    paymentAmount: 1300,
    termLength: 10,
    paymentFrequency: "WEEKLY",
    status,
    moraRate: 0,
    createdAt: start,
    startingDate: start,
    updatedAt: start,
    closedAt: null,
    nickname: null,
    customer: {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Ana Pérez",
      nickname: null,
      preferredPaymentDay: null
    },
    payments: paid.map((amount, i) => ({
      id: `p${i}`,
      kind: "INSTALLMENT",
      status: "COMPLETED",
      amount,
      paidAt: new Date(start.getTime() + i * 7 * 86400000),
      method: "CASH",
      collectedById: null,
      linkedPaymentId: null,
      notes: null,
      moraAccrualFrom: null,
      collectedBy: null
    }))
  };
}

describe("createGetRenewalQuote", () => {
  afterEach(() => sinon.restore());

  it("quotes remaining balance + mora as the suggested payoff", async () => {
    const client = {
      loan: { findUnique: sinon.stub().resolves(loanRow("ACTIVE", Array(8).fill(1300))) }
    };
    const quote = await createGetRenewalQuote(client as any)({ loanId: 10034 });

    expect(quote.remainingBalance).to.equal(2600);
    expect(quote.suggestedPayoff).to.equal(quote.remainingBalance + quote.moraAccrued);
    expect(quote.cuotasCovered).to.equal(8);
    expect(quote.currentTerms).to.deep.equal({
      principal: 10000,
      termLength: 10,
      paymentAmount: 1300,
      paymentFrequency: "WEEKLY"
    });
  });

  it("refuses a loan that is not ACTIVE", async () => {
    const client = { loan: { findUnique: sinon.stub().resolves(loanRow("RENEWED", [])) } };
    try {
      await createGetRenewalQuote(client as any)({ loanId: 10034 });
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as { code?: string }).code).to.equal("PRECONDITION_FAILED");
    }
  });

  it("rejects an invalid loan number before touching the database", async () => {
    const client = { loan: { findUnique: sinon.stub() } };
    try {
      await createGetRenewalQuote(client as any)({ loanId: -1 });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).to.be.instanceOf(ValidationError);
    }
    expect(client.loan.findUnique.called).to.be.false;
  });
});
