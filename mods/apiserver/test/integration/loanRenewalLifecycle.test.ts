/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The renewal process against a real database (openspec add-loan-renewal):
 * nothing touches loans or the ledger until finalize; finalize recomputes what
 * is owed and posts only the net; a changed amount rolls everything back; cancel
 * leaves no trace; and the two roles that may renew can.
 */
import { expect } from "chai";
import { getLoanDueDate, type RenewalActor } from "@mikro/common";
import {
  createCancelLoanRenewal,
  createFinalizeLoanRenewal,
  createGenerateRenewalContract,
  createGetLoanRenewalQuote,
  createStartLoanRenewal,
  createUpdateRenewalTerms,
  createUploadRenewalDocument,
  createUploadRenewalSignedContract
} from "../../src/api/loanRenewals/index.js";
import {
  createTestDb,
  createAuthenticatedCaller,
  applySchema,
  type TestDb,
  type AuthenticatedCaller
} from "./setup.js";

// Must match test/fixtures/mikro.json's accounting.disbursementAccountId and the
// fixed userId createAuthenticatedCaller sets as ctx.userId.
const DISBURSEMENT_ACCOUNT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";

const ADMIN: RenewalActor = { id: ADMIN_ID, roles: ["ADMIN"] };
const REVIEWER: RenewalActor = { id: ADMIN_ID, roles: ["REVIEWER"] };
const COLLECTOR: RenewalActor = { id: ADMIN_ID, roles: ["COLLECTOR"] };

const errCode = (e: unknown) => (e as { code?: string }).code;

describe("loan renewal process", () => {
  let db: TestDb;
  let caller: AuthenticatedCaller;
  const contractCalls: unknown[] = [];

  const stubRender = async (_customer: unknown, terms: unknown) => {
    contractCalls.push(terms);
    return {
      dataBase64: "QUJD",
      filename: "contrato-stub.pdf",
      mimeType: "application/pdf" as const,
      saved: {
        filename: "stub-generated-contract.pdf",
        size: 3,
        sha256: "stub-generated-sha",
        absolutePath: "/tmp/stub-generated-contract.pdf"
      }
    };
  };

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
    contractCalls.length = 0;
    await db.businessEvent.deleteMany();
    await db.accountingTransaction.deleteMany();
    await db.payment.deleteMany();
    await db.customerDocument.deleteMany();
    await db.loanRenewal.deleteMany();
    await db.loan.deleteMany();
    await db.customer.deleteMany();
    await db.userRole.deleteMany();
    await db.user.deleteMany();
    await db.user.create({ data: { id: ADMIN_ID, name: "Pedro", phone: "+18095550001" } });
    await db.accountingAccount.update({
      where: { id: DISBURSEMENT_ACCOUNT_ID },
      data: { currentBalance: 100_000, isActive: true }
    });
    caller = createAuthenticatedCaller(db);
  });

  after(async () => {
    await db.$disconnect();
  });

  /** An ACTIVE 10 × 1,300 weekly loan with 8 cuotas paid → 2,600 still owed. */
  async function seedLoan() {
    const collector = await caller.createUser({
      name: "Cobrador",
      phone: "+18095550002",
      role: "COLLECTOR"
    });
    const customer = await caller.createCustomer({
      name: "Rosa Pérez",
      phone: "+18095550003",
      idNumber: "031-0567812-4",
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
    const pay = (n: number) =>
      db.payment.createMany({
        data: Array.from({ length: n }, () => ({
          amount: 1_300,
          paidAt: new Date(),
          method: "CASH" as const,
          status: "COMPLETED" as const,
          kind: "INSTALLMENT" as const,
          loanId: loan.id,
          collectedById: collector.id
        }))
      });
    await pay(8);
    return { customer, loan, collector, pay };
  }

  const start = (loanId: number, actor = ADMIN, terms?: Record<string, unknown>) =>
    createStartLoanRenewal(db)({ loanId, terms }, actor);

  /** Drive a renewal to SIGNED: contract generated, signed copy uploaded. */
  async function toSigned(loanNumber: number, terms?: Record<string, unknown>) {
    const r = await start(loanNumber, ADMIN, terms);
    await createGenerateRenewalContract(db, { renderContract: stubRender as never })(
      { id: r.id },
      ADMIN
    );
    await createUploadRenewalSignedContract(db)(
      {
        id: r.id,
        originalName: "firmado.pdf",
        mimeType: "application/pdf",
        dataBase64: "U0lHTkVEQ09OVFJBQ1Q="
      },
      ADMIN
    );
    return r.id;
  }

  describe("start", () => {
    it("opens a DRAFT and writes nothing to loans or the ledger", async () => {
      const { loan } = await seedLoan();
      const r = await start(loan.loanId);

      expect(r.status).to.equal("DRAFT");
      expect(r.terms.principal).to.equal(10_000);
      expect(r.quoted.owed).to.equal(2_600);
      expect(r.quoted.net).to.equal(7_400);
      expect((await db.loan.findUniqueOrThrow({ where: { id: loan.id } })).status).to.equal(
        "ACTIVE"
      );
      expect(await db.loan.count()).to.equal(1);
      expect(await db.accountingTransaction.count()).to.equal(0);
      const events = await db.businessEvent.findMany({ where: { type: "loan.renewal.started" } });
      expect(events).to.have.length(1);
      expect(events[0].renewalId).to.equal(r.id);
    });

    it("allows both admins and reviewers, and rejects other roles", async () => {
      const { loan } = await seedLoan();
      const r = await start(loan.loanId, REVIEWER);
      expect(r.status).to.equal("DRAFT");
      await createCancelLoanRenewal(db)({ id: r.id }, REVIEWER);

      try {
        await start(loan.loanId, COLLECTOR);
        expect.fail("should have thrown");
      } catch (e) {
        expect(errCode(e)).to.equal("FORBIDDEN");
      }
    });

    it("refuses a second open renewal on the same loan, and cancelling frees the loan", async () => {
      const { loan } = await seedLoan();
      const first = await start(loan.loanId);
      try {
        await start(loan.loanId);
        expect.fail("should have thrown");
      } catch (e) {
        expect(errCode(e)).to.equal("CONFLICT");
      }
      await createCancelLoanRenewal(db)({ id: first.id }, ADMIN);
      const again = await start(loan.loanId);
      expect(again.id).to.not.equal(first.id);
      expect(await db.loanRenewal.count({ where: { loanId: loan.id } })).to.equal(2);
    });

    it("rejects terms whose principal does not cover what is owed", async () => {
      const { loan } = await seedLoan();
      try {
        await createStartLoanRenewal(db)(
          { loanId: loan.loanId, terms: { principal: 2_000 } },
          ADMIN
        );
        expect.fail("should have thrown");
      } catch (e) {
        expect(errCode(e)).to.equal("BAD_REQUEST");
      }
      expect(await db.loanRenewal.count()).to.equal(0);
    });

    it("refuses a loan that is not ACTIVE", async () => {
      const { loan } = await seedLoan();
      await db.loan.update({ where: { id: loan.id }, data: { status: "COMPLETED" } });
      try {
        await start(loan.loanId);
        expect.fail("should have thrown");
      } catch (e) {
        expect(errCode(e)).to.equal("PRECONDITION_FAILED");
      }
    });
  });

  describe("terms and contract", () => {
    it("generates the contract from the stored terms only, never from what is owed", async () => {
      const { loan } = await seedLoan();
      const r = await start(loan.loanId);
      const out = await createGenerateRenewalContract(db, { renderContract: stubRender as never })(
        { id: r.id },
        ADMIN
      );

      expect(out.renewal.status).to.equal("CONTRACT_READY");
      expect(contractCalls).to.have.length(1);
      const terms = contractCalls[0] as Record<string, unknown>;
      expect(terms.principal).to.equal(10_000);
      expect(terms.installments).to.equal(10);
      expect(Object.keys(terms).join(",")).to.not.match(/owed|payoff|balance|net/i);
      const docs = await db.customerDocument.findMany({ where: { renewalId: r.id } });
      expect(docs).to.have.length(1);
      expect(docs[0].loanId).to.equal(null);
    });

    it("editing the terms clears the contract and returns to DRAFT", async () => {
      const { loan } = await seedLoan();
      const r = await start(loan.loanId);
      await createGenerateRenewalContract(db, { renderContract: stubRender as never })(
        { id: r.id },
        ADMIN
      );

      const edited = await createUpdateRenewalTerms(db)(
        { id: r.id, terms: { principal: 12_000, paymentAmount: 1_500 } },
        REVIEWER
      );
      expect(edited.status).to.equal("DRAFT");
      expect(edited.contractFilename).to.equal(null);
      expect(edited.terms.principal).to.equal(12_000);
      expect(edited.quoted.net).to.equal(9_400);
      expect(await db.customerDocument.count({ where: { renewalId: r.id } })).to.equal(0);
    });

    it("rejects an edit whose principal no longer covers what is owed", async () => {
      const { loan } = await seedLoan();
      const r = await start(loan.loanId);
      try {
        await createUpdateRenewalTerms(db)({ id: r.id, terms: { principal: 2_600 } }, ADMIN);
        expect.fail("should have thrown");
      } catch (e) {
        expect(errCode(e)).to.equal("BAD_REQUEST");
      }
    });

    it("needs a generated contract before a signed one", async () => {
      const { loan } = await seedLoan();
      const r = await start(loan.loanId);
      try {
        await createUploadRenewalSignedContract(db)(
          { id: r.id, originalName: "x.pdf", mimeType: "application/pdf", dataBase64: "U0lH" },
          ADMIN
        );
        expect.fail("should have thrown");
      } catch (e) {
        expect(errCode(e)).to.equal("CONFLICT");
      }
    });

    it("a supporting document after the contract makes the renewal ready", async () => {
      const { loan } = await seedLoan();
      const r = await start(loan.loanId);
      await createGenerateRenewalContract(db, { renderContract: stubRender as never })(
        { id: r.id },
        ADMIN
      );
      const out = await createUploadRenewalDocument(db)(
        {
          id: r.id,
          type: "OTHER",
          originalName: "comprobante.pdf",
          mimeType: "application/pdf",
          dataBase64: "RE9D"
        },
        ADMIN
      );
      expect(out.status).to.equal("SIGNED");
    });
  });

  describe("cancel", () => {
    it("leaves the loan, the ledger and loans table untouched", async () => {
      const { loan } = await seedLoan();
      const id = await toSigned(loan.loanId);

      const out = await createCancelLoanRenewal(db)(
        { id, reason: "El cliente se arrepintió" },
        REVIEWER
      );
      expect(out.status).to.equal("CANCELLED");
      expect(out.cancelReason).to.equal("El cliente se arrepintió");
      expect((await db.loan.findUniqueOrThrow({ where: { id: loan.id } })).status).to.equal(
        "ACTIVE"
      );
      expect(await db.loan.count()).to.equal(1);
      expect(await db.accountingTransaction.count()).to.equal(0);
      expect(await db.businessEvent.count({ where: { type: "loan.renewal.cancelled" } })).to.equal(
        1
      );
    });

    it("cannot cancel a completed renewal", async () => {
      const { loan } = await seedLoan();
      const id = await toSigned(loan.loanId);
      await createFinalizeLoanRenewal(db)({ id, confirmedNet: 7_400 }, ADMIN);
      try {
        await createCancelLoanRenewal(db)({ id }, ADMIN);
        expect.fail("should have thrown");
      } catch (e) {
        expect(errCode(e)).to.equal("CONFLICT");
      }
    });
  });

  describe("finalize", () => {
    it("owes 2,600, new loan 10,000 → closes the old, opens the new, posts only the 7,400 net", async () => {
      const { customer, loan } = await seedLoan();
      const id = await toSigned(loan.loanId);

      const quote = await createGetLoanRenewalQuote(db)({ id });
      expect(quote.owed).to.equal(2_600);
      expect(quote.net).to.equal(7_400);

      const out = await createFinalizeLoanRenewal(db)({ id, confirmedNet: quote.net }, REVIEWER);

      const old = await db.loan.findUniqueOrThrow({ where: { id: loan.id } });
      expect(old.status).to.equal("RENEWED");
      expect(old.closedAt).to.be.instanceOf(Date);
      const created = await db.loan.findUniqueOrThrow({ where: { loanId: out.newLoan.loanId } });
      expect(created.status).to.equal("ACTIVE");
      expect(created.customerId).to.equal(customer.id);
      expect(created.renewedFromLoanId).to.equal(loan.id);
      expect(Number(created.principal)).to.equal(10_000);

      const account = await db.accountingAccount.findUniqueOrThrow({
        where: { id: DISBURSEMENT_ACCOUNT_ID }
      });
      expect(Number(account.currentBalance)).to.equal(100_000 - 7_400);
      const txns = await db.accountingTransaction.findMany();
      expect(txns).to.have.length(1);
      expect(txns[0].type).to.equal("WITHDRAWAL");
      expect(Number(txns[0].amount)).to.equal(7_400);
      expect(txns[0].reference).to.equal(`loan-renewal:${created.loanId}`);

      const docs = await db.customerDocument.findMany({ where: { renewalId: id } });
      expect(docs).to.have.length(2);
      for (const d of docs) expect(d.loanId).to.equal(created.id);

      const renewal = await db.loanRenewal.findUniqueOrThrow({ where: { id } });
      expect(renewal.status).to.equal("COMPLETED");
      expect(renewal.openKey).to.equal(null);
      expect(renewal.newLoanId).to.equal(created.id);
      expect(renewal.ledgerTransactionId).to.equal(txns[0].id);

      const completed = await db.businessEvent.findMany({
        where: { type: "loan.renewal.completed" }
      });
      expect(completed).to.have.length(1);
      expect(Number(completed[0].amount)).to.equal(7_400);
      expect(completed[0].renewalId).to.equal(id);
    });

    it("finalized loan is due on the contract's first date", async () => {
      const { loan } = await seedLoan();
      const id = await toSigned(loan.loanId, {
        paymentFrequency: "BIWEEKLY",
        startingDate: "2026-11-10"
      });
      const quote = await createGetLoanRenewalQuote(db)({ id });

      const out = await createFinalizeLoanRenewal(db)({ id, confirmedNet: quote.net }, REVIEWER);

      const created = await db.loan.findUniqueOrThrow({ where: { loanId: out.newLoan.loanId } });
      expect(created.firstDueDate!.toISOString()).to.equal("2026-11-15T00:00:00.000Z");
      expect(created.startingDate!.toISOString()).to.equal("2026-11-01T00:00:00.000Z");
      expect(getLoanDueDate(created, 0).toISOString()).to.equal("2026-11-15T00:00:00.000Z");
    });

    it("fails with NET_CHANGED when what is owed moved, writing nothing, then succeeds once re-confirmed", async () => {
      const { loan, pay } = await seedLoan();
      const id = await toSigned(loan.loanId);
      const confirmed = (await createGetLoanRenewalQuote(db)({ id })).net;
      expect(confirmed).to.equal(7_400);

      // The customer pays a cuota after the user saw the net: owed drops to 1,300.
      await pay(1);

      try {
        await createFinalizeLoanRenewal(db)({ id, confirmedNet: confirmed }, ADMIN);
        expect.fail("should have thrown");
      } catch (e) {
        expect(errCode(e)).to.equal("CONFLICT");
        expect(String((e as Error).message)).to.match(/cambió|confírmalo/i);
      }
      expect((await db.loan.findUniqueOrThrow({ where: { id: loan.id } })).status).to.equal(
        "ACTIVE"
      );
      expect((await db.loanRenewal.findUniqueOrThrow({ where: { id } })).status).to.equal("SIGNED");
      expect(await db.loan.count()).to.equal(1);
      expect(await db.accountingTransaction.count()).to.equal(0);

      const fresh = await createGetLoanRenewalQuote(db)({ id });
      expect(fresh.changed).to.equal(true);
      expect(fresh.net).to.equal(8_700);
      const out = await createFinalizeLoanRenewal(db)({ id, confirmedNet: fresh.net }, ADMIN);
      expect(out.disbursement.amount).to.equal(8_700);
      expect(Number((await db.accountingTransaction.findMany())[0].amount)).to.equal(8_700);
    });

    it("only runs from SIGNED", async () => {
      const { loan } = await seedLoan();
      const r = await start(loan.loanId);
      try {
        await createFinalizeLoanRenewal(db)({ id: r.id, confirmedNet: 7_400 }, ADMIN);
        expect.fail("should have thrown");
      } catch (e) {
        expect(errCode(e)).to.equal("CONFLICT");
      }
    });

    it("rolls back everything when the ledger post fails", async () => {
      const { loan } = await seedLoan();
      const id = await toSigned(loan.loanId);
      await db.accountingAccount.update({
        where: { id: DISBURSEMENT_ACCOUNT_ID },
        data: { isActive: false }
      });

      try {
        await createFinalizeLoanRenewal(db)({ id, confirmedNet: 7_400 }, ADMIN);
        expect.fail("should have thrown");
      } catch (e) {
        expect(String((e as Error).message)).to.match(/inactive/i);
      }

      expect((await db.loan.findUniqueOrThrow({ where: { id: loan.id } })).status).to.equal(
        "ACTIVE"
      );
      expect(await db.loan.count()).to.equal(1);
      const renewal = await db.loanRenewal.findUniqueOrThrow({ where: { id } });
      expect(renewal.status).to.equal("SIGNED");
      expect(renewal.openKey).to.equal(loan.id);
      expect(await db.businessEvent.count({ where: { type: "loan.renewal.completed" } })).to.equal(
        0
      );
      const docs = await db.customerDocument.findMany({ where: { renewalId: id } });
      for (const d of docs) expect(d.loanId).to.equal(null);
    });

    it("lets exactly one of two concurrent finalizes win", async () => {
      const { loan } = await seedLoan();
      const id = await toSigned(loan.loanId);
      const finalize = createFinalizeLoanRenewal(db);
      const results = await Promise.allSettled([
        finalize({ id, confirmedNet: 7_400 }, ADMIN),
        finalize({ id, confirmedNet: 7_400 }, ADMIN)
      ]);

      expect(results.filter((r) => r.status === "fulfilled")).to.have.length(1);
      expect(await db.loan.count()).to.equal(2);
      expect(await db.accountingTransaction.count()).to.equal(1);
    });

    it("rejects a collector", async () => {
      const { loan } = await seedLoan();
      const id = await toSigned(loan.loanId);
      try {
        await createFinalizeLoanRenewal(db)({ id, confirmedNet: 7_400 }, COLLECTOR);
        expect.fail("should have thrown");
      } catch (e) {
        expect(errCode(e)).to.equal("FORBIDDEN");
      }
    });
  });
});
