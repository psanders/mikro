/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Loan renewal against a real database (openspec add-loan-renewal): the old
 * loan closes as RENEWED, the new loan links back to it, the net amount leaves
 * the disbursement account, and a conflict rolls everything back.
 */
import { expect } from "chai";
import {
  createTestDb,
  createAuthenticatedCaller,
  applySchema,
  type TestDb,
  type AuthenticatedCaller
} from "./setup.js";

// Must match test/fixtures/mikro.json's accounting.disbursementAccountId and
// the fixed userId createAuthenticatedCaller sets as ctx.userId.
const DISBURSEMENT_ACCOUNT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";

describe("renewLoan", () => {
  let db: TestDb;
  let caller: AuthenticatedCaller;

  before(async () => {
    db = createTestDb();
    await applySchema(db);
    await db.accountingAccount.create({
      data: {
        id: DISBURSEMENT_ACCOUNT_ID,
        name: "Caja principal (test)",
        kind: "CASH",
        currentBalance: 100_000
      }
    });
  });

  beforeEach(async () => {
    await db.businessEvent.deleteMany();
    await db.accountingTransaction.deleteMany();
    await db.payment.deleteMany();
    await db.customerDocument.deleteMany();
    await db.loan.deleteMany();
    await db.customer.deleteMany();
    await db.userRole.deleteMany();
    await db.user.deleteMany();
    await db.user.create({ data: { id: ADMIN_ID, name: "Pedro", phone: "+18095550001" } });
    await db.accountingAccount.update({
      where: { id: DISBURSEMENT_ACCOUNT_ID },
      data: { currentBalance: 100_000 }
    });
    caller = createAuthenticatedCaller(db);
  });

  after(async () => {
    await db.$disconnect();
  });

  /** An ACTIVE 10 × 1,300 weekly loan with 8 cuotas paid → 2,600 still owed. */
  async function seedPartlyPaidLoan() {
    const collector = await caller.createUser({
      name: "Cobrador",
      phone: "+18095550002",
      role: "COLLECTOR"
    });
    const customer = await caller.createCustomer({
      name: "Ana Pérez",
      phone: "+18095550003",
      idNumber: "001-0000001-9",
      homeAddress: "Calle 1",
      isBusinessOwner: true,
      assignedCollectorId: collector.id,
      isActive: true,
      preferredPaymentDay: null
    });
    const loan = await caller.createLoan({
      customerId: customer.id,
      principal: 10_000,
      termLength: 10,
      paymentAmount: 1_300,
      paymentFrequency: "WEEKLY",
      startingDate: new Date()
    });
    await db.payment.createMany({
      data: Array.from({ length: 8 }, () => ({
        amount: 1_300,
        paidAt: new Date(),
        method: "CASH" as const,
        status: "COMPLETED" as const,
        kind: "INSTALLMENT" as const,
        loanId: loan.id,
        collectedById: collector.id
      }))
    });
    return { customer, loan };
  }

  it("quotes the payoff, renews atomically and posts the net withdrawal", async () => {
    const { customer, loan } = await seedPartlyPaidLoan();

    const quote = await caller.getRenewalQuote({ loanId: loan.loanId });
    expect(quote.remainingBalance).to.equal(2_600);

    const result = await caller.renewLoan({
      loanId: loan.loanId,
      payoffAmount: quote.suggestedPayoff,
      principal: 10_000,
      termLength: 10,
      paymentAmount: 1_300,
      paymentFrequency: "WEEKLY",
      generateContract: false
    });

    const old = await db.loan.findUniqueOrThrow({ where: { id: loan.id } });
    expect(old.status).to.equal("RENEWED");
    expect(old.closedAt).to.be.instanceOf(Date);

    const renewed = await db.loan.findUniqueOrThrow({ where: { loanId: result.newLoan.loanId } });
    expect(renewed.status).to.equal("ACTIVE");
    expect(renewed.customerId).to.equal(customer.id);
    expect(renewed.renewedFromLoanId).to.equal(loan.id);

    const net = 10_000 - quote.suggestedPayoff;
    const account = await db.accountingAccount.findUniqueOrThrow({
      where: { id: DISBURSEMENT_ACCOUNT_ID }
    });
    expect(Number(account.currentBalance)).to.equal(100_000 - net);
    const txns = await db.accountingTransaction.findMany();
    expect(txns).to.have.length(1);
    expect(txns[0].type).to.equal("WITHDRAWAL");
    expect(txns[0].reference).to.equal(`loan-renewal:${renewed.loanId}`);

    const events = await db.businessEvent.findMany({ where: { type: "loan.renewed" } });
    expect(events).to.have.length(1);
    expect(events[0].loanId).to.equal(renewed.id);
  });

  it("refuses a second renewal of the same loan and leaves the ledger untouched", async () => {
    const { loan } = await seedPartlyPaidLoan();
    const input = {
      loanId: loan.loanId,
      payoffAmount: 2_600,
      principal: 10_000,
      termLength: 10,
      paymentAmount: 1_300,
      paymentFrequency: "WEEKLY" as const,
      generateContract: false
    };
    await caller.renewLoan(input);

    try {
      await caller.renewLoan(input);
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as { code?: string }).code).to.equal("PRECONDITION_FAILED");
    }
    expect(await db.loan.count()).to.equal(2);
    expect(await db.accountingTransaction.count()).to.equal(1);
  });

  it("rolls back everything when the ledger post fails", async () => {
    const { loan } = await seedPartlyPaidLoan();
    await db.accountingAccount.update({
      where: { id: DISBURSEMENT_ACCOUNT_ID },
      data: { isActive: false }
    });

    try {
      await caller.renewLoan({
        loanId: loan.loanId,
        payoffAmount: 2_600,
        principal: 10_000,
        termLength: 10,
        paymentAmount: 1_300,
        paymentFrequency: "WEEKLY",
        generateContract: false
      });
      expect.fail("should have thrown");
    } catch (e) {
      expect(String((e as Error).message)).to.match(/inactive/i);
    } finally {
      await db.accountingAccount.update({
        where: { id: DISBURSEMENT_ACCOUNT_ID },
        data: { isActive: true }
      });
    }

    const old = await db.loan.findUniqueOrThrow({ where: { id: loan.id } });
    expect(old.status).to.equal("ACTIVE");
    expect(old.closedAt).to.equal(null);
    expect(await db.loan.count()).to.equal(1);
    expect(await db.businessEvent.count({ where: { type: "loan.renewed" } })).to.equal(0);
  });
});
