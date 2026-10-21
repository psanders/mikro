/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The renewal process and customer documents through the real tRPC router, by
 * role (openspec add-loan-renewal): admins AND reviewers run renewals and handle
 * customer documents; collectors can do neither; only admins delete documents.
 */
import { expect } from "chai";
import { appRouter } from "../../src/trpc/routers/index.js";
import { createTestDb, createAuthenticatedCaller, applySchema, type TestDb } from "./setup.js";

type Role = "ADMIN" | "COLLECTOR" | "REVIEWER";

const DISBURSEMENT_ACCOUNT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
/** 1×1 transparent PNG. */
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("renewals and customer documents by role", () => {
  let db: TestDb;
  const as = (roles: Role[]) =>
    appRouter.createCaller({ db: db as any, isAuthenticated: true, userId: ADMIN_ID, roles });

  const code = async (p: Promise<unknown>) => {
    try {
      await p;
      return "OK";
    } catch (e) {
      return (e as { code?: string }).code ?? "ERROR";
    }
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
  });

  after(async () => {
    await db.$disconnect();
  });

  async function seed() {
    const admin = createAuthenticatedCaller(db);
    const collector = await admin.createUser({
      name: "Cobrador",
      phone: "+18095550002",
      role: "COLLECTOR"
    });
    const customer = await admin.createCustomer({
      name: "Rosa Pérez",
      phone: "+18095550003",
      idNumber: "031-0567812-4",
      homeAddress: "Calle 1",
      isBusinessOwner: true,
      assignedCollectorId: collector.id,
      isActive: true,
      preferredPaymentDay: null
    });
    const loan = await admin.createLoan({
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

  it("a reviewer runs a whole renewal: start → contract → signed copy → finalize, net 7,400", async () => {
    const { loan } = await seed();
    const reviewer = as(["REVIEWER"]);

    const started = await reviewer.startLoanRenewal({ loanId: loan.loanId });
    expect(started.status).to.equal("DRAFT");

    const generated = await reviewer.generateRenewalContract({ id: started.id });
    expect(generated.renewal.status).to.equal("CONTRACT_READY");
    expect(generated.contract.mimeType).to.equal("application/pdf");
    expect(generated.contract.dataBase64.length).to.be.greaterThan(100);

    const signed = await reviewer.uploadRenewalSignedContract({
      id: started.id,
      originalName: "firmado.pdf",
      mimeType: "application/pdf",
      dataBase64: Buffer.from("%PDF-1.4 signed copy").toString("base64")
    });
    expect(signed.status).to.equal("SIGNED");

    const quote = await reviewer.getLoanRenewalQuote({ id: started.id });
    expect(quote.net).to.equal(7_400);
    const done = await reviewer.finalizeLoanRenewal({ id: started.id, confirmedNet: quote.net });
    expect(done.disbursement.amount).to.equal(7_400);

    expect((await db.loan.findUniqueOrThrow({ where: { id: loan.id } })).status).to.equal(
      "RENEWED"
    );
    const open = await reviewer.listOpenLoanRenewals({});
    expect(open).to.have.length(0);
    const mine = await reviewer.listLoanRenewalsByCustomer({ customerId: started.customer.id });
    expect(mine.map((r) => r.status)).to.deep.equal(["COMPLETED"]);
  });

  it("admins and reviewers can start a renewal; collectors cannot", async () => {
    const { loan } = await seed();
    expect(await code(as(["COLLECTOR"]).startLoanRenewal({ loanId: loan.loanId }))).to.equal(
      "FORBIDDEN"
    );
    expect(await code(as(["ADMIN"]).startLoanRenewal({ loanId: loan.loanId }))).to.equal("OK");
  });

  it("finds the renewal in progress on a loan, and none once it is cancelled", async () => {
    const { loan } = await seed();
    const reviewer = as(["REVIEWER"]);
    expect(await reviewer.getOpenLoanRenewal({ loanId: loan.loanId })).to.equal(null);

    const started = await reviewer.startLoanRenewal({ loanId: loan.loanId });
    const open = await reviewer.getOpenLoanRenewal({ loanId: loan.loanId });
    expect(open?.id).to.equal(started.id);
    expect(open?.status).to.equal("DRAFT");

    await reviewer.cancelLoanRenewal({ id: started.id });
    expect(await reviewer.getOpenLoanRenewal({ loanId: loan.loanId })).to.equal(null);
    expect(await code(as(["COLLECTOR"]).getOpenLoanRenewal({ loanId: loan.loanId }))).to.equal(
      "FORBIDDEN"
    );
  });

  it("collectors are rejected on every renewal and customer-document procedure", async () => {
    const { customer, loan } = await seed();
    const started = await as(["ADMIN"]).startLoanRenewal({ loanId: loan.loanId });
    const c = as(["COLLECTOR"]);
    const id = started.id;
    const attempts: Array<[string, Promise<unknown>]> = [
      ["updateRenewalTerms", c.updateRenewalTerms({ id, terms: { principal: 9_000 } })],
      ["getLoanRenewal", c.getLoanRenewal({ id })],
      ["getLoanRenewalQuote", c.getLoanRenewalQuote({ id })],
      ["generateRenewalContract", c.generateRenewalContract({ id })],
      ["cancelLoanRenewal", c.cancelLoanRenewal({ id })],
      ["finalizeLoanRenewal", c.finalizeLoanRenewal({ id, confirmedNet: 7_400 })],
      ["listOpenLoanRenewals", c.listOpenLoanRenewals({})],
      ["listLoanRenewalsByCustomer", c.listLoanRenewalsByCustomer({ customerId: customer.id })],
      ["listCustomerDocuments", c.listCustomerDocuments({ customerId: customer.id })],
      [
        "uploadCustomerDocument",
        c.uploadCustomerDocument({
          customerId: customer.id,
          type: "OTHER",
          originalName: "a.png",
          mimeType: "image/png",
          dataBase64: PNG
        })
      ]
    ];
    for (const [name, p] of attempts) {
      expect(await code(p), name).to.equal("FORBIDDEN");
    }
  });

  it("reviewers upload, list and read customer documents; only admins delete", async () => {
    const { customer } = await seed();
    const reviewer = as(["REVIEWER"]);
    const doc = await reviewer.uploadCustomerDocument({
      customerId: customer.id,
      type: "ID_FRONT",
      originalName: "cedula-frente.png",
      mimeType: "image/png",
      dataBase64: PNG
    });
    expect(doc.type).to.equal("ID_FRONT");
    expect(doc.source).to.equal("DIRECT");
    expect(doc.uploadedById).to.equal(ADMIN_ID);

    const list = await reviewer.listCustomerDocuments({ customerId: customer.id });
    expect(list).to.have.length(1);
    const file = await reviewer.getCustomerDocument({ id: doc.id });
    expect(file.dataBase64).to.equal(PNG);
    expect(file.mimeType).to.equal("image/png");

    expect(await code(reviewer.deleteCustomerDocument({ id: doc.id }))).to.equal("FORBIDDEN");
    expect(await db.customerDocument.count()).to.equal(1);
    expect(await code(as(["ADMIN"]).deleteCustomerDocument({ id: doc.id }))).to.equal("OK");
    expect(await db.customerDocument.count()).to.equal(0);
  });

  it("a reviewer can edit the customer profile fields", async () => {
    const { customer } = await seed();
    const updated = await as(["REVIEWER"]).updateCustomer({
      id: customer.id,
      homeAddress: "C/ Duarte #14",
      jobPosition: "Dueña de colmado",
      income: 38_000,
      isBusinessOwner: true,
      collectionPoint: null
    });
    expect(updated.homeAddress).to.equal("C/ Duarte #14");
    expect(Number(updated.income)).to.equal(38_000);
  });
});
