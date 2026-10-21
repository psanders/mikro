/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Renewal events in the founder feed (openspec add-loan-renewal): each event
 * joins the renewal's LIVE state, reviewers see renewal events (and only those
 * beyond their review queue), and open renewals stay listed regardless of date.
 */
import { expect } from "chai";
import { appRouter } from "../../src/trpc/routers/index.js";
import { createTestDb, createAuthenticatedCaller, applySchema, type TestDb } from "./setup.js";

type Role = "ADMIN" | "COLLECTOR" | "REVIEWER";
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const DISBURSEMENT_ACCOUNT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";

describe("renewal events in the feed", () => {
  let db: TestDb;
  const as = (roles: Role[], userId = ADMIN_ID) =>
    appRouter.createCaller({ db: db as any, isAuthenticated: true, userId, roles });

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
  });

  after(async () => {
    await db.$disconnect();
  });

  async function seedLoan(loanNumberOffset = 0) {
    const admin = createAuthenticatedCaller(db);
    const collector = await admin.createUser({
      name: "Cobrador",
      phone: `+1809555${String(2000 + loanNumberOffset)}`,
      role: "COLLECTOR"
    });
    const customer = await admin.createCustomer({
      name: `Rosa Pérez ${loanNumberOffset}`,
      phone: `+1809555${String(3000 + loanNumberOffset)}`,
      idNumber: `031-056781${loanNumberOffset}-4`,
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
    return { customer, loan, collector };
  }

  it("joins the renewal's live state onto its events", async () => {
    const { loan } = await seedLoan();
    const reviewer = as(["REVIEWER"]);
    const started = await reviewer.startLoanRenewal({ loanId: loan.loanId });

    let feed = await reviewer.listFeedEvents({ limit: 20 });
    const ev = feed.items.find((i) => i.type === "loan.renewal.started")!;
    expect(ev.renewalId).to.equal(started.id);
    expect(ev.renewal?.status).to.equal("DRAFT");
    expect(ev.renewal?.oldLoanNumber).to.equal(loan.loanId);
    expect(ev.renewal?.quotedNet).to.equal(7_400);
    expect(ev.renewal?.hasContract).to.equal(false);

    await reviewer.cancelLoanRenewal({ id: started.id });
    feed = await reviewer.listFeedEvents({ limit: 20 });
    // The frozen "started" event now shows the renewal's CURRENT status.
    const same = feed.items.find((i) => i.type === "loan.renewal.started")!;
    expect(same.renewal?.status).to.equal("CANCELLED");
    expect(feed.items.map((i) => i.type)).to.include("loan.renewal.cancelled");
  });

  it("a reviewer sees renewal events but not payments or other business events", async () => {
    const { loan, collector } = await seedLoan();
    await createAuthenticatedCaller(db)
      .getLoanByLoanId({ loanId: loan.loanId })
      .catch(() => undefined);
    await db.businessEvent.create({
      data: {
        type: "payment.collected",
        actorName: "Cobrador",
        actorId: collector.id,
        summary: "cobró",
        payload: JSON.stringify({ paymentId: ADMIN_ID, method: "CASH", kind: "INSTALLMENT" })
      }
    });
    await as(["ADMIN"]).startLoanRenewal({ loanId: loan.loanId });

    const reviewerFeed = await as(["REVIEWER"]).listFeedEvents({ limit: 50 });
    const types = reviewerFeed.items.map((i) => i.type);
    expect(types).to.include("loan.renewal.started");
    expect(types).to.not.include("payment.collected");

    const adminFeed = await as(["ADMIN"]).listFeedEvents({ limit: 50 });
    expect(adminFeed.items.map((i) => i.type)).to.include.members([
      "loan.renewal.started",
      "payment.collected"
    ]);
  });

  it("another reviewer sees a renewal someone else started", async () => {
    const { loan } = await seedLoan();
    const ana = "11111111-1111-4111-8111-111111111111";
    const luis = "22222222-2222-4222-8222-222222222222";
    await db.user.create({ data: { id: ana, name: "Ana", phone: "+18095550011" } });
    await db.user.create({ data: { id: luis, name: "Luis", phone: "+18095550012" } });
    await as(["REVIEWER"], ana).startLoanRenewal({ loanId: loan.loanId });
    const feed = await as(["REVIEWER"], luis).listFeedEvents({ limit: 20 });
    expect(feed.items.map((i) => i.type)).to.include("loan.renewal.started");
  });

  it("lists the newest event of each open renewal and drops finished ones", async () => {
    const a = await seedLoan(1);
    const b = await seedLoan(2);
    const admin = as(["ADMIN"]);
    const ra = await admin.startLoanRenewal({ loanId: a.loan.loanId });
    const rb = await admin.startLoanRenewal({ loanId: b.loan.loanId });
    await admin.updateRenewalTerms({ id: ra.id, terms: { principal: 12_000 } });
    await admin.cancelLoanRenewal({ id: rb.id });

    const open = await as(["REVIEWER"]).listOpenRenewalEvents();
    expect(open).to.have.length(1);
    expect(open[0].renewalId).to.equal(ra.id);
    expect(open[0].type).to.equal("loan.renewal.terms_updated");
    expect(open[0].renewal?.status).to.equal("DRAFT");
    expect(open[0].loanNumber).to.equal(a.loan.loanId);
  });

  it("keeps an old open renewal listed whatever the date range", async () => {
    const { loan } = await seedLoan();
    const r = await as(["ADMIN"]).startLoanRenewal({ loanId: loan.loanId });
    await db.businessEvent.updateMany({
      where: { renewalId: r.id },
      data: { occurredAt: new Date(Date.now() - 20 * 24 * 3600 * 1000) }
    });
    const open = await as(["REVIEWER"]).listOpenRenewalEvents();
    expect(open.map((i) => i.renewalId)).to.deep.equal([r.id]);
  });

  it("rejects collectors", async () => {
    try {
      await as(["COLLECTOR"]).listOpenRenewalEvents();
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as { code?: string }).code).to.equal("FORBIDDEN");
    }
  });
});
