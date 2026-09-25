/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Collectors gather evidence for applications in review (openspec
 * add-collector-evidence): the map link as required evidence, collector write
 * access without assignment, the oldest-first queue, the collector detail
 * read, the completion event, and the map link following the customer.
 */
import { expect } from "chai";
import { createTestDb, applySchema, type TestDb } from "./setup.js";
import { appRouter } from "../../src/trpc/index.js";

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const ACCOUNT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const MAP_URL = "https://maps.google.com/?q=19.793412,-70.688401";
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n").toString("base64");

type Role = "ADMIN" | "COLLECTOR" | "REVIEWER";

describe("collector evidence (integration)", () => {
  let db: TestDb;
  let seq = 0;
  const phone = () => `+1809${String(30_000_000 + ++seq).slice(1)}`;
  const cedula = () => `031-${String(3_000_000 + ++seq).slice(-7)}-2`;
  const as = (userId: string, roles: Role[]) =>
    appRouter.createCaller({ db: db as any, isAuthenticated: true, userId, roles });

  let admin: ReturnType<typeof as>;
  let reviewer: ReturnType<typeof as>;
  let otherReviewer: ReturnType<typeof as>;
  let collector: ReturnType<typeof as>;
  let reviewerId: string;
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

  after(async () => {
    await db.$disconnect();
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
    admin = as(ADMIN_ID, ["ADMIN"]);
    reviewerId = (
      await admin.createUser({ name: "Ana Evaluadora", phone: phone(), role: "REVIEWER" })
    ).id;
    const otherId = (
      await admin.createUser({ name: "Luis Evaluador", phone: phone(), role: "REVIEWER" })
    ).id;
    collectorId = (
      await admin.createUser({ name: "Miguel Cobrador", phone: phone(), role: "COLLECTOR" })
    ).id;
    reviewer = as(reviewerId, ["REVIEWER"]);
    otherReviewer = as(otherId, ["REVIEWER"]);
    collector = as(collectorId, ["COLLECTOR"]);
    await db.accountingAccount.create({
      data: { id: ACCOUNT_ID, name: "Caja principal", kind: "CASH", currentBalance: 100_000 }
    });
  });

  /** An application taken by Ana (IN_REVIEW), no evidence yet. */
  async function inReview(businessName = "Salón Yoka", idNumber = cedula()) {
    const app = await admin.createApplication({
      patch: {
        firstName: "Yokasta",
        lastName: "Díaz",
        phone: phone(),
        idNumber,
        homeAddress: "C/ Duarte #45",
        addressReference: "Frente al parque",
        businessName,
        requestedAmount: "15,000",
        requestedTermWeeks: "12 semanas",
        province: "PUERTO_PLATA"
      },
      sendPromo: false
    });
    await reviewer.assignApplication({ id: app.id });
    return app;
  }

  const idSide = (id: string, side: "FRONT" | "BACK") => ({
    id,
    side,
    originalName: `${side}.png`,
    mimeType: "image/png" as const,
    dataBase64: PNG
  });
  const photo = (id: string, label: string) => ({
    id,
    kind: "BUSINESS_PHOTO" as const,
    label,
    originalName: `${label}.png`,
    mimeType: "image/png" as const,
    dataBase64: PNG
  });

  async function allButMapUrl(id: string, who = collector) {
    await who.uploadIdImage(idSide(id, "FRONT"));
    await who.uploadIdImage(idSide(id, "BACK"));
    for (const l of ["Fachada", "Interior", "Mercancía"])
      await who.uploadApplicationDocument(photo(id, l));
  }

  const completedEvents = () =>
    db.businessEvent.findMany({ where: { type: "application.evidence_completed" } });

  describe("the map link", () => {
    it("is required: sending to decision without it names the location", async () => {
      const app = await inReview();
      await allButMapUrl(app.id, reviewer);
      await reviewer.setApplicationRecommendation({
        id: app.id,
        reviewerRecommendation: "Aprobar"
      });
      await rejected(
        reviewer.sendApplicationToDecision({ id: app.id }),
        "CONFLICT",
        "EVIDENCE_INCOMPLETE"
      );
      const evidence = await reviewer.getApplicationEvidence({ id: app.id });
      expect(evidence.status.location).to.equal(false);

      await reviewer.setApplicationMapUrl({ id: app.id, mapUrl: "https://maps.app.goo.gl/AbC123" });
      const sent = await reviewer.sendApplicationToDecision({ id: app.id });
      expect(sent.status).to.equal("PENDING_DECISION");
    });

    it("rejects links that aren't Google Maps", async () => {
      const app = await inReview();
      await rejected(
        collector.setApplicationMapUrl({ id: app.id, mapUrl: "https://example.com/maps" }),
        "BAD_REQUEST"
      );
      await rejected(
        collector.setApplicationMapUrl({ id: app.id, mapUrl: "http://maps.google.com/?q=1,2" }),
        "BAD_REQUEST"
      );
    });

    it("can be cleared", async () => {
      const app = await inReview();
      await collector.setApplicationMapUrl({ id: app.id, mapUrl: MAP_URL });
      const cleared = await collector.setApplicationMapUrl({ id: app.id, mapUrl: null });
      expect(cleared.mapUrl).to.equal(null);
    });
  });

  describe("who may write evidence", () => {
    it("any collector adds, replaces and deletes evidence without being assigned", async () => {
      const app = await inReview();
      const byAna = await reviewer.uploadApplicationDocument(photo(app.id, "Fachada"));
      await collector.uploadIdImage(idSide(app.id, "BACK"));
      await collector.uploadIdImage(idSide(app.id, "BACK"));
      await collector.deleteApplicationDocument({ documentId: byAna.id });
      await collector.setApplicationMapUrl({ id: app.id, mapUrl: MAP_URL });
      const evidence = await collector.getApplicationEvidence({ id: app.id });
      expect(evidence.status).to.include({ location: true, idBack: true, idFront: false });
      expect(evidence.documents).to.have.lengthOf(0);
    });

    it("collectors can't edit the data or the recommendation", async () => {
      const app = await inReview();
      await rejected(
        collector.updateApplication({ id: app.id, patch: { businessName: "Otro" } }),
        "FORBIDDEN"
      );
      await rejected(
        collector.setApplicationRecommendation({ id: app.id, reviewerRecommendation: "x" }),
        "FORBIDDEN"
      );
    });

    it("a reviewer who isn't the assignee still can't upload", async () => {
      const app = await inReview();
      await rejected(otherReviewer.uploadIdImage(idSide(app.id, "FRONT")), "FORBIDDEN");
    });

    it("evidence is locked for everyone once it goes to decision", async () => {
      const app = await inReview();
      await allButMapUrl(app.id);
      await collector.setApplicationMapUrl({ id: app.id, mapUrl: MAP_URL });
      await reviewer.setApplicationRecommendation({
        id: app.id,
        reviewerRecommendation: "Aprobar"
      });
      await reviewer.sendApplicationToDecision({ id: app.id });
      await rejected(collector.uploadApplicationDocument(photo(app.id, "Letrero")), "CONFLICT");
      await rejected(collector.setApplicationMapUrl({ id: app.id, mapUrl: null }), "CONFLICT");
    });

    it("collectors read evidence only while the application is in review", async () => {
      const app = await inReview();
      const doc = await collector.uploadApplicationDocument(photo(app.id, "Fachada"));
      await allButMapUrl(app.id);
      await collector.setApplicationMapUrl({ id: app.id, mapUrl: MAP_URL });
      expect((await collector.getApplicationDocument({ documentId: doc.id })).document.id).to.equal(
        doc.id
      );
      await reviewer.setApplicationRecommendation({
        id: app.id,
        reviewerRecommendation: "Aprobar"
      });
      await reviewer.sendApplicationToDecision({ id: app.id });
      await rejected(collector.getApplicationDocument({ documentId: doc.id }), "NOT_FOUND");
      await rejected(collector.getIdImage({ id: app.id, side: "FRONT" }), "NOT_FOUND");
      // The reviewer still reads it.
      expect((await reviewer.getApplicationDocument({ documentId: doc.id })).document.id).to.equal(
        doc.id
      );
    });
  });

  describe("the collector's queue and detail", () => {
    it("lists every application in review, oldest first, with progress; complete ones stay", async () => {
      const older = await inReview("Colmado Viejo");
      const newer = await inReview("Colmado Nuevo");
      await allButMapUrl(older.id);
      await collector.setApplicationMapUrl({ id: older.id, mapUrl: MAP_URL });
      await collector.uploadIdImage(idSide(newer.id, "FRONT"));

      const queue = await collector.listEvidenceQueue();
      expect(queue.map((q) => q.businessName)).to.deep.equal(["Colmado Viejo", "Colmado Nuevo"]);
      expect(queue[0]).to.include({ complete: true });
      expect(queue[0]!.progress).to.deep.equal({ have: 6, need: 6 });
      expect(queue[1]).to.include({ complete: false, addressReference: "Frente al parque" });
      expect(queue[1]!.progress).to.deep.equal({ have: 1, need: 6 });

      await reviewer.setApplicationRecommendation({
        id: older.id,
        reviewerRecommendation: "Aprobar"
      });
      await reviewer.sendApplicationToDecision({ id: older.id });
      const after = await collector.listEvidenceQueue();
      expect(after.map((q) => q.businessName)).to.deep.equal(["Colmado Nuevo"]);
    });

    it("reviewers without the collector role can't list", async () => {
      await rejected(reviewer.listEvidenceQueue(), "FORBIDDEN");
    });

    it("the detail read has the visit and the evidence, and no review data", async () => {
      const app = await inReview();
      await reviewer.setApplicationRecommendation({
        id: app.id,
        reviewerRecommendation: "Aprobar"
      });
      await collector.uploadApplicationDocument(photo(app.id, "Fachada"));
      const task = await collector.getEvidenceTask({ id: app.id });
      expect(task).to.include({
        businessName: "Salón Yoka",
        homeAddress: "C/ Duarte #45",
        idFront: false
      });
      expect(task.documents.map((d) => d.label)).to.deep.equal(["Fachada"]);
      for (const key of [
        "score",
        "reviewerRecommendation",
        "requestedAmount",
        "approvedAmount",
        "rawData"
      ]) {
        expect(task).to.not.have.property(key);
      }
    });

    it("the detail read is NOT_FOUND once the application leaves review", async () => {
      const app = await inReview();
      await reviewer.rejectApplication({ id: app.id, reason: "DOCUMENTS" });
      await rejected(collector.getEvidenceTask({ id: app.id }), "NOT_FOUND");
    });
  });

  describe("the completion event", () => {
    it("is recorded once when a collector saves the last missing piece", async () => {
      const app = await inReview();
      await allButMapUrl(app.id);
      expect(await completedEvents()).to.have.lengthOf(0);
      await collector.setApplicationMapUrl({ id: app.id, mapUrl: MAP_URL });
      const events = await completedEvents();
      expect(events).to.have.lengthOf(1);
      expect(events[0]).to.include({ actorId: collectorId, applicationId: app.id });
      expect(events[0]!.summary).to.contain("Miguel Cobrador");
      // A further write on complete evidence records nothing new.
      await collector.uploadApplicationDocument(photo(app.id, "Letrero"));
      expect(await completedEvents()).to.have.lengthOf(1);
    });

    it("is not recorded when the assignee completes it", async () => {
      const app = await inReview();
      await allButMapUrl(app.id, reviewer);
      await reviewer.setApplicationMapUrl({ id: app.id, mapUrl: MAP_URL });
      expect(await completedEvents()).to.have.lengthOf(0);
    });

    it("shows in the assignee's feed", async () => {
      const app = await inReview();
      await allButMapUrl(app.id);
      await collector.setApplicationMapUrl({ id: app.id, mapUrl: MAP_URL });
      const feed = await reviewer.listFeedEvents({ applicationId: app.id });
      expect(feed.items.map((i) => i.type)).to.include("application.evidence_completed");
    });
  });

  describe("conversion", () => {
    async function approvedWithContract(mapUrl: string | null, idNumber = cedula()) {
      const app = await inReview("Salón Yoka", idNumber);
      await allButMapUrl(app.id);
      await collector.setApplicationMapUrl({ id: app.id, mapUrl: MAP_URL });
      await reviewer.setApplicationRecommendation({
        id: app.id,
        reviewerRecommendation: "Aprobar"
      });
      await reviewer.sendApplicationToDecision({ id: app.id });
      await admin.approveApplication({ id: app.id, approvedAmount: 10000, approvedTermWeeks: 10 });
      await reviewer.uploadSignedContract({
        id: app.id,
        originalName: "contrato.pdf",
        mimeType: "application/pdf",
        dataBase64: PDF
      });
      // Simulate an application without a link (e.g. approved before this flow).
      await db.loanApplication.update({ where: { id: app.id }, data: { mapUrl } });
      return app;
    }
    const convert = (id: string) =>
      reviewer.convertApplication({
        id,
        principal: 10000,
        termLength: 10,
        paymentAmount: 1300,
        paymentFrequency: "WEEKLY",
        assignedCollectorId: collectorId,
        accountId: ACCOUNT_ID
      });

    it("copies the map link to the new customer", async () => {
      const app = await approvedWithContract(MAP_URL);
      const result = await convert(app.id);
      const customer = await db.customer.findUnique({ where: { id: result.customerId } });
      expect(customer!.mapUrl).to.equal(MAP_URL);
    });

    it("keeps a returning customer's link when the application has none", async () => {
      const idNumber = cedula();
      const first = await approvedWithContract(MAP_URL, idNumber);
      const { customerId } = await convert(first.id);
      const second = await approvedWithContract(null, idNumber);
      await convert(second.id);
      const customer = await db.customer.findUnique({ where: { id: customerId } });
      expect(customer!.mapUrl).to.equal(MAP_URL);
    });
  });
});
