/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The whole application review lifecycle through the real tRPC router on a
 * real (in-memory SQLite) database, acting as the people who do it:
 *
 *   RECEIVED → assign → evidence → sendToDecision → returnToReviewer →
 *   sendToDecision → approve → signed contract → convert (chosen account)
 *
 * plus the refusals that make the flow correct: wrong role, wrong person,
 * wrong status, missing evidence/contract/terms, and locked evidence.
 * openspec add-application-review-flow.
 */
import { expect } from "chai";
import { createTestDb, applySchema, createAuthenticatedCaller, type TestDb } from "./setup.js";
import { appRouter } from "../../src/trpc/index.js";

// createAuthenticatedCaller acts as this ADMIN user id.
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
// test/fixtures/mikro.json accounting.disbursementAccountId (the default account).
const DEFAULT_ACCOUNT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const BANK_ACCOUNT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2";

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n").toString("base64");

type Role = "ADMIN" | "COLLECTOR" | "REVIEWER";

describe("application review lifecycle (integration)", () => {
  let db: TestDb;
  let seq = 0;
  const phone = () => `+1809${String(20_000_000 + ++seq).slice(1)}`;
  const cedula = () => `031-${String(2_000_000 + ++seq).slice(-7)}-2`;

  const as = (userId: string, roles: Role[]) =>
    appRouter.createCaller({ db: db as any, isAuthenticated: true, userId, roles });

  let admin: ReturnType<typeof as>;
  let reviewer: ReturnType<typeof as>;
  let otherReviewer: ReturnType<typeof as>;
  let reviewerId: string;
  let otherReviewerId: string;
  let collectorId: string;

  async function rejected(promise: Promise<unknown>, code: string, reason?: string) {
    let thrown: { code?: string; message?: string } | undefined;
    try {
      await promise;
    } catch (err) {
      thrown = err as { code?: string; message?: string };
    }
    expect(thrown, `expected ${code}${reason ? ` (${reason})` : ""}`).to.not.equal(undefined);
    expect(thrown!.code).to.equal(code);
    if (reason) expect(thrown!.message).to.contain(reason);
  }

  before(async () => {
    db = createTestDb();
    await applySchema(db);
  });

  beforeEach(async () => {
    for (const table of [
      "businessEvent",
      "customerDocument",
      "applicationDocument",
      "accountingTransaction",
      "followUpJob",
      "loanApplication",
      "loan",
      "customer",
      "accountingAccount",
      "userRole",
      "user"
    ] as const) {
      await (db as any)[table].deleteMany();
    }
    await db.user.create({ data: { id: ADMIN_ID, name: "Pedro Admin", phone: phone() } });
    await db.userRole.create({ data: { userId: ADMIN_ID, role: "ADMIN" } });
    admin = createAuthenticatedCaller(db);

    reviewerId = (
      await admin.createUser({ name: "Ana Evaluadora", phone: phone(), role: "REVIEWER" })
    ).id;
    otherReviewerId = (
      await admin.createUser({ name: "Luis Evaluador", phone: phone(), role: "REVIEWER" })
    ).id;
    collectorId = (
      await admin.createUser({ name: "Miguel Cobrador", phone: phone(), role: "COLLECTOR" })
    ).id;
    reviewer = as(reviewerId, ["REVIEWER"]);
    otherReviewer = as(otherReviewerId, ["REVIEWER"]);

    await db.accountingAccount.create({
      data: {
        id: DEFAULT_ACCOUNT_ID,
        name: "Caja principal",
        kind: "CASH",
        currentBalance: 100_000
      }
    });
    await db.accountingAccount.create({
      data: { id: BANK_ACCOUNT_ID, name: "Banco Popular", kind: "BANK", currentBalance: 200_000 }
    });
  });

  after(async () => {
    await db.$disconnect();
  });

  /** A manual application: RECEIVED, in the shared queue. */
  async function received() {
    return admin.createApplication({
      patch: {
        firstName: "Yokasta",
        lastName: "Díaz",
        phone: phone(),
        idNumber: cedula(),
        homeAddress: "C/ Duarte #45",
        businessName: "Salón Yoka",
        requestedAmount: "15,000",
        requestedTermWeeks: "12 semanas",
        province: "PUERTO_PLATA"
      },
      sendPromo: false
    });
  }

  const MAP_URL = "https://maps.google.com/?q=19.793412,-70.688401";

  async function completeEvidence(id: string, as = reviewer) {
    await as.setApplicationMapUrl({ id, mapUrl: MAP_URL });
    await as.uploadIdImage({
      id,
      side: "FRONT",
      originalName: "f.png",
      mimeType: "image/png",
      dataBase64: PNG
    });
    await as.uploadIdImage({
      id,
      side: "BACK",
      originalName: "b.png",
      mimeType: "image/png",
      dataBase64: PNG
    });
    for (const label of ["Fachada", "Interior", "Mercancía"]) {
      await as.uploadApplicationDocument({
        id,
        kind: "BUSINESS_PHOTO",
        label,
        originalName: `${label}.png`,
        mimeType: "image/png",
        dataBase64: PNG
      });
    }
    await as.setApplicationRecommendation({
      id,
      reviewerRecommendation: "Aprobar RD$10,000 a 10 semanas"
    });
  }

  async function status(id: string) {
    return (await db.loanApplication.findUnique({ where: { id } }))!.status;
  }

  it("runs the whole path, with a send-back, to a converted customer and a disbursement", async () => {
    const app = await received();
    expect(app.status).to.equal("RECEIVED");

    // Only "Tomar" is possible on RECEIVED: no edits, no uploads.
    await rejected(
      reviewer.updateApplication({ id: app.id, patch: { businessName: "X" } }),
      "CONFLICT"
    );

    const taken = await reviewer.assignApplication({ id: app.id });
    expect(taken.status).to.equal("IN_REVIEW");
    expect(taken.assignedReviewerId).to.equal(reviewerId);

    // Someone else can neither take it nor work on it.
    await rejected(otherReviewer.assignApplication({ id: app.id }), "FORBIDDEN");
    await rejected(
      otherReviewer.uploadApplicationDocument({
        id: app.id,
        kind: "BUSINESS_PHOTO",
        originalName: "x.png",
        mimeType: "image/png",
        dataBase64: PNG
      }),
      "FORBIDDEN"
    );

    // Not sendable until the evidence and the recommendation are in.
    await rejected(
      reviewer.sendApplicationToDecision({ id: app.id }),
      "CONFLICT",
      "EVIDENCE_INCOMPLETE"
    );
    await completeEvidence(app.id);
    const evidence = await reviewer.getApplicationEvidence({ id: app.id });
    expect(evidence.status.complete).to.equal(true);
    expect(evidence.documents).to.have.lengthOf(3);

    await reviewer.sendApplicationToDecision({ id: app.id });
    expect(await status(app.id)).to.equal("PENDING_DECISION");

    // Evidence is locked while the admin decides; the reviewer cannot decide.
    await rejected(
      reviewer.uploadApplicationDocument({
        id: app.id,
        kind: "OTHER",
        originalName: "luz.pdf",
        mimeType: "application/pdf",
        dataBase64: PDF
      }),
      "CONFLICT"
    );
    await rejected(
      reviewer.approveApplication({ id: app.id, approvedAmount: 10000, approvedTermWeeks: 10 }),
      "FORBIDDEN"
    );

    // Admin sends it back with a note; evidence unlocks for the assignee.
    await rejected(admin.returnApplicationToReviewer({ id: app.id, note: "" }), "BAD_REQUEST");
    await admin.returnApplicationToReviewer({ id: app.id, note: "Falta foto de la mercancía" });
    expect(await status(app.id)).to.equal("IN_REVIEW");
    await reviewer.uploadApplicationDocument({
      id: app.id,
      kind: "BUSINESS_PHOTO",
      label: "Mercancía 2",
      originalName: "m2.png",
      mimeType: "image/png",
      dataBase64: PNG
    });
    await reviewer.sendApplicationToDecision({ id: app.id });

    const approved = await admin.approveApplication({
      id: app.id,
      approvedAmount: 10000,
      approvedTermWeeks: 10,
      note: "Monto ajustado"
    });
    expect(approved.status).to.equal("APPROVED");
    expect(Number(approved.approvedAmount)).to.equal(10000);
    expect(approved.decidedById).to.equal(ADMIN_ID);

    const convertInput = {
      id: app.id,
      principal: 10000,
      termLength: 10,
      paymentAmount: 1300,
      paymentFrequency: "WEEKLY" as const,
      assignedCollectorId: collectorId,
      accountId: BANK_ACCOUNT_ID
    };
    await rejected(reviewer.convertApplication(convertInput), "CONFLICT", "CONTRACT_REQUIRED");
    const signed = await reviewer.uploadSignedContract({
      id: app.id,
      originalName: "contrato.pdf",
      mimeType: "application/pdf",
      dataBase64: PDF
    });
    expect(signed.status).to.equal("APPROVED");
    await rejected(
      reviewer.convertApplication({ ...convertInput, principal: 15000 }),
      "BAD_REQUEST",
      "AMOUNT_MISMATCH"
    );

    const converted = await reviewer.convertApplication(convertInput);
    expect(converted.application.status).to.equal("CONVERTED");

    // Disbursed from the chosen account, not the default one.
    const tx = await db.accountingTransaction.findMany({ where: { type: "WITHDRAWAL" } });
    expect(tx).to.have.lengthOf(1);
    expect(tx[0]!.accountId).to.equal(BANK_ACCOUNT_ID);
    expect(Number(tx[0]!.amount)).to.equal(10000);

    // Every piece of evidence follows the customer.
    const docs = await db.customerDocument.findMany({
      where: { customerId: converted.customerId }
    });
    const types = docs.map((d) => d.type).sort();
    expect(types).to.deep.equal([
      "BUSINESS_PHOTO",
      "BUSINESS_PHOTO",
      "BUSINESS_PHOTO",
      "BUSINESS_PHOTO",
      "CONTRACT",
      "ID_BACK",
      "ID_FRONT"
    ]);

    // The event log tells the same story, in order.
    const events = await db.businessEvent.findMany({
      where: { applicationId: app.id },
      orderBy: { occurredAt: "asc" }
    });
    expect(events.map((e) => e.type)).to.deep.equal([
      "application.received",
      "application.assigned",
      "application.sent_to_decision",
      "application.returned",
      "application.sent_to_decision",
      "application.approved",
      "application.converted"
    ]);
  });

  it("offers only the configured disbursement accounts and refuses any other", async () => {
    const accounts = await reviewer.listDisbursementAccounts();
    expect(accounts.map((a) => [a.name, a.isDefault, a.available])).to.deep.equal([
      ["Caja General", true, true],
      ["Cuenta de Recaudación", false, true]
    ]);
    expect(accounts[0]!.balance).to.equal(100_000);

    const other = await db.accountingAccount.create({
      data: { name: "Tarjeta de crédito", kind: "CREDIT_CARD", currentBalance: 0 }
    });
    const app = await received();
    await reviewer.assignApplication({ id: app.id });
    await completeEvidence(app.id);
    await reviewer.sendApplicationToDecision({ id: app.id });
    await admin.approveApplication({ id: app.id, approvedAmount: 10000, approvedTermWeeks: 10 });
    await reviewer.uploadSignedContract({
      id: app.id,
      originalName: "c.pdf",
      mimeType: "application/pdf",
      dataBase64: PDF
    });
    const input = {
      id: app.id,
      principal: 10000,
      termLength: 10,
      paymentAmount: 1300,
      paymentFrequency: "WEEKLY" as const,
      assignedCollectorId: collectorId
    };
    await rejected(reviewer.convertApplication({ ...input, accountId: other.id }), "BAD_REQUEST");
    expect(await status(app.id)).to.equal("APPROVED");

    // No account given → the configured default (Caja General).
    await reviewer.convertApplication(input);
    const tx = await db.accountingTransaction.findFirst({ where: { type: "WITHDRAWAL" } });
    expect(tx!.accountId).to.equal(DEFAULT_ACCOUNT_ID);
  });

  it("prints the approved amount on the contract and binds conversion to its terms", async () => {
    const app = await received();
    await reviewer.assignApplication({ id: app.id });
    await completeEvidence(app.id);
    await reviewer.sendApplicationToDecision({ id: app.id });
    // Requested 15,000; the admin approves 10,000.
    await admin.approveApplication({ id: app.id, approvedAmount: 10000, approvedTermWeeks: 10 });
    await rejected(
      otherReviewer.generateApplicationContract({
        id: app.id,
        installments: 10,
        installmentAmount: 1300,
        frequency: "WEEKLY",
        startDate: "2026-09-29"
      }),
      "FORBIDDEN"
    );
    const contract = await reviewer.generateApplicationContract({
      id: app.id,
      installments: 10,
      installmentAmount: 1300,
      frequency: "WEEKLY",
      startDate: "2026-09-29"
    });
    expect(contract.mimeType).to.equal("application/pdf");
    const stored = await db.loanApplication.findUnique({ where: { id: app.id } });
    expect(stored!.contractTerms).to.deep.include({
      installments: 10,
      installmentAmount: 1300,
      frequency: "WEEKLY"
    });

    await reviewer.uploadSignedContract({
      id: app.id,
      originalName: "c.pdf",
      mimeType: "application/pdf",
      dataBase64: PDF
    });
    const base = {
      id: app.id,
      principal: 10000,
      termLength: 10,
      paymentAmount: 1300,
      paymentFrequency: "WEEKLY" as const,
      assignedCollectorId: collectorId
    };
    await rejected(
      reviewer.convertApplication({ ...base, paymentAmount: 1200 }),
      "BAD_REQUEST",
      "TERMS_MISMATCH"
    );
    const done = await reviewer.convertApplication(base);
    const loan = await db.loan.findFirst({ where: { loanId: done.loanId } });
    expect(Number(loan!.principal)).to.equal(10000);
    expect(Number(loan!.paymentAmount)).to.equal(1300);
  });

  it("lets the assignee reject during review, with a reason", async () => {
    const app = await received();
    await reviewer.assignApplication({ id: app.id });
    await rejected(
      otherReviewer.rejectApplication({ id: app.id, reason: "PAYMENT_CAPACITY" }),
      "FORBIDDEN"
    );
    const r = await reviewer.rejectApplication({ id: app.id, reason: "PAYMENT_CAPACITY" });
    expect(r.status).to.equal("REJECTED");
    expect(r.rejectionReason).to.equal("PAYMENT_CAPACITY");
  });

  it("requires a note when the admin rejects with OTHER", async () => {
    const app = await received();
    await reviewer.assignApplication({ id: app.id });
    await completeEvidence(app.id);
    await reviewer.sendApplicationToDecision({ id: app.id });
    await rejected(admin.rejectApplication({ id: app.id, reason: "OTHER" }), "BAD_REQUEST");
    const r = await admin.rejectApplication({
      id: app.id,
      reason: "OTHER",
      note: "Negocio cerrado"
    });
    expect(r.decisionNote).to.equal("Negocio cerrado");
  });

  it("marks an approved application withdrawn when the customer backs out", async () => {
    const app = await received();
    await reviewer.assignApplication({ id: app.id });
    await completeEvidence(app.id);
    await reviewer.sendApplicationToDecision({ id: app.id });
    await admin.approveApplication({ id: app.id, approvedAmount: 10000, approvedTermWeeks: 10 });
    const w = await reviewer.withdrawApplication({ id: app.id });
    expect(w.status).to.equal("ABANDONED");
    await rejected(
      reviewer.convertApplication({
        id: app.id,
        principal: 10000,
        termLength: 10,
        paymentAmount: 1300,
        paymentFrequency: "WEEKLY",
        assignedCollectorId: collectorId
      }),
      "CONFLICT"
    );
  });

  it("lets an admin reassign an application already in review", async () => {
    const app = await received();
    await reviewer.assignApplication({ id: app.id });
    await rejected(
      reviewer.assignApplication({ id: app.id, assigneeId: otherReviewerId }),
      "FORBIDDEN"
    );
    const moved = await admin.assignApplication({ id: app.id, assigneeId: otherReviewerId });
    expect(moved.status).to.equal("IN_REVIEW");
    expect(moved.assignedReviewerId).to.equal(otherReviewerId);
    // The previous assignee lost write access.
    await rejected(
      reviewer.updateApplication({ id: app.id, patch: { businessName: "X" } }),
      "FORBIDDEN"
    );
  });

  it("scopes the feed: each reviewer sees the queue and their own work, the admin what awaits them", async () => {
    const mine = await received();
    const theirs = await received();
    const queued = await received();
    await reviewer.assignApplication({ id: mine.id });
    await otherReviewer.assignApplication({ id: theirs.id });
    await completeEvidence(mine.id);
    await reviewer.sendApplicationToDecision({ id: mine.id });

    const idsIn = async (caller: ReturnType<typeof as>) =>
      new Set((await caller.listFeedEvents({ limit: 100 })).items.map((i) => i.applicationId));

    const reviewerSees = await idsIn(reviewer);
    expect(reviewerSees.has(mine.id)).to.equal(true);
    expect(reviewerSees.has(queued.id)).to.equal(true);
    expect(reviewerSees.has(theirs.id)).to.equal(false);

    const adminOnly = as(ADMIN_ID, ["ADMIN"]);
    const feed = await adminOnly.listFeedEvents({ limit: 100 });
    const pending = feed.items.find((i) => i.type === "application.sent_to_decision");
    expect(pending?.applicationId).to.equal(mine.id);
    expect(pending?.application?.status).to.equal("PENDING_DECISION");
  });

  it("keeps the WhatsApp nudge but never auto-abandons a submitted application", async () => {
    // Guarded in the follow-up worker; asserted here against the real schema.
    const app = await received();
    const { createHandleAbandonJob } =
      await import("../../src/follow-up/createHandleAbandonJob.js");
    const job = await db.followUpJob.create({
      data: { applicationId: app.id, type: "ABANDON", scheduledFor: new Date(), status: "PENDING" }
    });
    await createHandleAbandonJob(db as any)(job as any);
    expect(await status(app.id)).to.equal("RECEIVED");
    expect((await db.followUpJob.findUnique({ where: { id: job.id } }))!.status).to.equal(
      "CANCELLED"
    );
  });
});
