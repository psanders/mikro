/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { ValidationError } from "@mikro/common";
import { createRenewLoan } from "../../src/api/loans/createRenewLoan.js";

const OLD_ID = "11111111-1111-4111-8111-111111111111";
const NEW_ID = "22222222-2222-4222-8222-222222222222";
const CUSTOMER_ID = "33333333-3333-4333-8333-333333333333";
const ACCOUNT_ID = "44444444-4444-4444-8444-444444444444";
const TXN_ID = "55555555-5555-4555-8555-555555555555";
const ACTOR = { id: "66666666-6666-4666-8666-666666666666", roles: ["ADMIN"] as const };
const NOW = new Date("2026-10-14T15:00:00.000Z");

const validInput = {
  loanId: 10034,
  payoffAmount: 2800,
  principal: 10000,
  termLength: 10,
  paymentAmount: 1300,
  paymentFrequency: "WEEKLY" as const,
  generateContract: true
};

function makeClient(opts: { oldStatus?: string; raceLost?: boolean } = {}) {
  const oldLoan = {
    id: OLD_ID,
    loanId: 10034,
    status: opts.oldStatus ?? "ACTIVE",
    customerId: CUSTOMER_ID,
    customer: { id: CUSTOMER_ID, name: "Ana Pérez", idNumber: "001-0000000-1" }
  };
  const newLoan = { id: NEW_ID, loanId: 10051, customerId: CUSTOMER_ID, status: "ACTIVE" };
  const tx = {
    loan: {
      updateMany: sinon.stub().resolves({ count: opts.raceLost ? 0 : 1 }),
      findFirst: sinon.stub().resolves({ loanId: 10050 }),
      create: sinon.stub().resolves(newLoan),
      update: sinon.stub().resolves({ ...newLoan, renewedFromLoanId: OLD_ID })
    },
    accountingAccount: {
      findUnique: sinon.stub().resolves({ id: ACCOUNT_ID, name: "Caja", isActive: true }),
      update: sinon.stub().resolves({})
    },
    user: { findUnique: sinon.stub().resolves({ id: ACTOR.id, name: "Pedro" }) },
    accountingTransaction: {
      create: sinon.stub().resolves({ id: TXN_ID }),
      findUniqueOrThrow: sinon.stub().resolves({
        id: TXN_ID,
        type: "WITHDRAWAL",
        amount: 7200,
        status: "POSTED",
        occurredAt: NOW,
        account: { id: ACCOUNT_ID, name: "Caja" },
        toAccount: null,
        category: null,
        createdBy: { id: ACTOR.id, name: "Pedro" },
        _count: { attachments: 0 }
      })
    },
    customerDocument: { create: sinon.stub().resolves({}) },
    businessEvent: { create: sinon.stub().resolves({ id: "evt" }) }
  };
  const client = {
    loan: { findUnique: sinon.stub().resolves(oldLoan) },
    $transaction: sinon.stub().callsFake(async (fn: (t: typeof tx) => unknown) => fn(tx))
  };
  return { client, tx };
}

function makeDeps() {
  return {
    renderContract: sinon.stub().resolves({
      dataBase64: "JVBERi0=",
      filename: "contrato-33333333.pdf",
      mimeType: "application/pdf" as const,
      saved: { filename: "abc.pdf", sha256: "abc", size: 5 }
    }),
    resolveAccountId: sinon.stub().returns(ACCOUNT_ID),
    now: () => NOW
  };
}

describe("createRenewLoan", () => {
  afterEach(() => sinon.restore());

  it("closes the old loan, opens the new one, posts the net WITHDRAWAL, stores the contract and records the event", async () => {
    const { client, tx } = makeClient();
    const deps = makeDeps();
    const renew = createRenewLoan(client as any, deps as any);

    const result = await renew(validInput, ACTOR);

    // 1. old loan → RENEWED, guarded on still ACTIVE
    const close = tx.loan.updateMany.firstCall.args[0];
    expect(close.where).to.deep.equal({ id: OLD_ID, status: "ACTIVE" });
    expect(close.data).to.deep.equal({ status: "RENEWED", closedAt: NOW });
    // 2. new loan linked to the old one
    expect(tx.loan.create.firstCall.args[0].data).to.include({
      customerId: CUSTOMER_ID,
      principal: 10000,
      loanId: 10051
    });
    expect(tx.loan.update.firstCall.args[0].data).to.deep.equal({ renewedFromLoanId: OLD_ID });
    // 3. net WITHDRAWAL
    const txn = tx.accountingTransaction.create.firstCall.args[0].data;
    expect(txn).to.include({
      type: "WITHDRAWAL",
      amount: 7200,
      accountId: ACCOUNT_ID,
      reference: "loan-renewal:10051"
    });
    expect(tx.accountingAccount.update.firstCall.args[0].data).to.deep.equal({
      currentBalance: { increment: -7200 }
    });
    // 4. contract tied to the new loan
    expect(tx.customerDocument.create.firstCall.args[0].data).to.include({
      type: "CONTRACT",
      loanId: NEW_ID,
      customerId: CUSTOMER_ID
    });
    // 5. event
    const evt = tx.businessEvent.create.firstCall.args[0].data;
    expect(evt.type).to.equal("loan.renewed");
    expect(evt.amount).to.equal(7200);
    expect(JSON.parse(evt.payload)).to.include({
      oldLoanNumber: 10034,
      newLoanNumber: 10051,
      payoff: 2800,
      netDisbursed: 7200
    });

    expect(result.oldLoanId).to.equal(10034);
    expect(result.disbursement.amount).to.equal(7200);
    expect(result.contract?.filename).to.equal("contrato-33333333.pdf");
    expect(result.contract).to.not.have.property("saved");
  });

  it("rejects invalid input with a ValidationError and writes nothing", async () => {
    const { client } = makeClient();
    const deps = makeDeps();
    const renew = createRenewLoan(client as any, deps as any);

    try {
      await renew({ ...validInput, principal: -5 }, ACTOR);
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).to.be.instanceOf(ValidationError);
    }
    expect(client.loan.findUnique.called).to.be.false;
    expect(client.$transaction.called).to.be.false;
    expect(deps.renderContract.called).to.be.false;
  });

  it("rejects a payoff that is not less than the new principal", async () => {
    const { client } = makeClient();
    const deps = makeDeps();
    const renew = createRenewLoan(client as any, deps as any);

    try {
      await renew({ ...validInput, payoffAmount: 10000 }, ACTOR);
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).to.be.instanceOf(ValidationError);
    }
    expect(client.$transaction.called).to.be.false;
  });

  it("refuses a loan that is not ACTIVE", async () => {
    const { client } = makeClient({ oldStatus: "COMPLETED" });
    const deps = makeDeps();
    const renew = createRenewLoan(client as any, deps as any);

    try {
      await renew(validInput, ACTOR);
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as { code?: string }).code).to.equal("PRECONDITION_FAILED");
    }
    expect(client.$transaction.called).to.be.false;
    expect(deps.renderContract.called).to.be.false;
  });

  it("throws CONFLICT and stops when the old loan changed concurrently", async () => {
    const { client, tx } = makeClient({ raceLost: true });
    const renew = createRenewLoan(client as any, makeDeps() as any);

    try {
      await renew(validInput, ACTOR);
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as { code?: string }).code).to.equal("CONFLICT");
    }
    expect(tx.loan.create.called).to.be.false;
    expect(tx.accountingTransaction.create.called).to.be.false;
    expect(tx.businessEvent.create.called).to.be.false;
  });

  it("skips the contract when generateContract is false", async () => {
    const { client, tx } = makeClient();
    const deps = makeDeps();
    const renew = createRenewLoan(client as any, deps as any);

    const result = await renew({ ...validInput, generateContract: false }, ACTOR);

    expect(deps.renderContract.called).to.be.false;
    expect(tx.customerDocument.create.called).to.be.false;
    expect(result.contract).to.be.undefined;
    expect(JSON.parse(tx.businessEvent.create.firstCall.args[0].data.payload)).to.not.have.property(
      "contractFilename"
    );
  });
});
