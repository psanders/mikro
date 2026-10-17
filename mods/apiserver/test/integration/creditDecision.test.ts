/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Credit decision engine through the real tRPC router on an in-memory SQLite
 * database (openspec add-credit-decision-engine): the extension pushes bureau
 * facts by cédula, the policy decides with the information in hand, the
 * evaluator acts under today's review rules, and only a checked hard NO blocks
 * the admin's approval.
 */
import { expect } from "chai";
import { toPcloudFacts, type CreditReportPush, type PcloudScrape } from "@mikro/score";
import { createTestDb, applySchema, createAuthenticatedCaller, type TestDb } from "./setup.js";
import { appRouter } from "../../src/trpc/index.js";

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

type Role = "ADMIN" | "COLLECTOR" | "REVIEWER";

/** Fire-and-forget decisions after application writes: let them land. */
const settle = () => new Promise((r) => setTimeout(r, 60));

/** Event payloads are stored as JSON text. */
const payloadOf = (e: { payload: unknown }) =>
  (typeof e.payload === "string" ? JSON.parse(e.payload) : e.payload) as Record<string, any>;

const summary = (moroso: "SI" | "NO", lenders: string) => ({
  "Cliente moroso": moroso,
  "Préstamos activos": "1",
  "Préstamos terminados": "0",
  "Empresas con este cliente": lenders,
  "Capital prestado": "RD$10,000.00",
  "Total codeudores": "0.00",
  "Capital adeudado": "RD$10,000.00"
});

const delinquent: PcloudScrape = {
  identity: { fullName: "Yokasta Díaz", birthDate: "1990-04-20" },
  kpis: { score: "399", scoreLabel: "Muy bajo (300-850)", onTime: "23%" },
  summary: summary("SI", "1"),
  lenders: [
    {
      name: "Prestamista Uno",
      count: "1 prestamo",
      totals: "Total otorgado: RD$10,000.00 |Capital adeudado: RD$10,000.00",
      rows: [
        ["RD$10,000.00", "VENCIDOSINCOBRABLE", "—", "570 d", "23 sept 2024", "", "RD$10,000.00"]
      ]
    }
  ],
  inquiries: [],
  comments: []
};

const clean: PcloudScrape = {
  identity: { fullName: "Yokasta Díaz", birthDate: "1990-04-20" },
  kpis: { score: "780", scoreLabel: "Bueno (300-850)", onTime: "98%" },
  summary: summary("NO", "1"),
  lenders: [
    {
      name: "Prestamista Uno",
      count: "1 prestamo",
      totals: "Total otorgado: RD$10,000.00 |Capital adeudado: RD$0.00",
      rows: [["RD$10,000.00", "TERMINADOS", "A TIEMPO", "—", "05 dic 2025", "", "RD$0.00"]]
    }
  ],
  inquiries: [],
  comments: []
};

describe("credit decision engine (integration)", () => {
  let db: TestDb;
  let seq = 0;
  const phone = () => `+1809${String(30_000_000 + ++seq).slice(1)}`;
  const cedula = () => `402-${String(3_000_000 + ++seq).slice(-7)}-1`;

  const as = (userId: string, roles: Role[]) =>
    appRouter.createCaller({ db: db as any, isAuthenticated: true, userId, roles });

  let admin: ReturnType<typeof as>;
  let reviewer: ReturnType<typeof as>;
  let collector: ReturnType<typeof as>;
  let reviewerId: string;

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

  const push = (ced: string, scrape: PcloudScrape, applicationId?: string): CreditReportPush => ({
    source: "PRESTAMOSCLOUD",
    cedula: ced,
    capturedAt: new Date().toISOString(),
    portalOrigin: "https://portal.prestamoscloud.com",
    adapterVersion: "3.14.1",
    rawSha256: "b".repeat(64),
    facts: toPcloudFacts(scrape),
    ...(applicationId ? { applicationId } : {})
  });

  before(async () => {
    db = createTestDb();
    await applySchema(db);
  });

  beforeEach(async () => {
    for (const table of [
      "businessEvent",
      "creditDecision",
      "creditReport",
      "applicationDocument",
      "followUpJob",
      "loanApplication",
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
    const collectorId = (
      await admin.createUser({ name: "Miguel Cobrador", phone: phone(), role: "COLLECTOR" })
    ).id;
    reviewer = as(reviewerId, ["REVIEWER"]);
    collector = as(collectorId, ["COLLECTOR"]);
  });

  after(async () => {
    await db.$disconnect();
  });

  async function application(ced: string) {
    const app = await admin.createApplication({
      patch: {
        firstName: "Yokasta",
        lastName: "Díaz",
        phone: phone(),
        idNumber: ced,
        dateOfBirth: "1990-04-20",
        homeAddress: "C/ Duarte #45",
        businessName: "Salón Yoka",
        requestedAmount: "15,000",
        requestedTermWeeks: "12 semanas",
        province: "PUERTO_PLATA"
      },
      sendPromo: false
    });
    await settle();
    return app;
  }

  async function readyForDecision(id: string) {
    await reviewer.assignApplication({ id });
    await reviewer.setApplicationMapUrl({ id, mapUrl: "https://maps.google.com/?q=19.79,-70.68" });
    for (const side of ["FRONT", "BACK"] as const) {
      await reviewer.uploadIdImage({
        id,
        side,
        originalName: `${side}.png`,
        mimeType: "image/png",
        dataBase64: PNG
      });
    }
    for (const label of ["Fachada", "Interior", "Mercancía"]) {
      await reviewer.uploadApplicationDocument({
        id,
        kind: "BUSINESS_PHOTO",
        label,
        originalName: `${label}.png`,
        mimeType: "image/png",
        dataBase64: PNG
      });
    }
    await reviewer.setApplicationRecommendation({
      id,
      reviewerRecommendation: "Aprobar",
      via: "extension"
    });
    await reviewer.sendApplicationToDecision({ id, via: "extension" });
  }

  it("decides with the information in hand when nothing was looked up", async () => {
    const ced = cedula();
    const app = await application(ced);
    const decision = await admin.getCreditDecision({ applicationId: app.id });
    expect(decision).to.not.equal(null);
    expect(decision!.outcome).to.not.equal("REJECT");
    expect(decision!.sourcesUsed).to.deep.equal(["isc"]);
    expect(decision!.unchecked.map((u) => u.reason)).to.include("PCLOUD_DELINQUENT");
    expect(decision!.nextSteps.map((s) => s.id)).to.include.members([
      "equifax_lookup",
      "pcloud_lookup"
    ]);
  });

  it("panel: shows the application and only today's actions", async () => {
    const ced = cedula();
    const app = await application(ced);
    let panel = await reviewer.getCreditPanel({ cedula: ced.replace(/-/g, "") });
    expect(panel.application!.id).to.equal(app.id);
    expect(panel.actions).to.include({ take: true, reject: false, recommend: false });

    await reviewer.assignApplication({ id: app.id, via: "extension" });
    panel = await reviewer.getCreditPanel({ cedula: ced });
    expect(panel.application!.isMine).to.equal(true);
    expect(panel.actions).to.include({ take: false, reject: true, recommend: true });
    expect(panel.actions.sendBlockedBy).to.include("3 fotos del negocio");

    // Someone else sees the score, not the actions.
    const luisId = (await admin.createUser({ name: "Luis", phone: phone(), role: "REVIEWER" })).id;
    const other = await as(luisId, ["REVIEWER"]).getCreditPanel({ cedula: ced });
    expect(other.application!.assigneeName).to.equal("Ana Evaluadora");
    expect(other.actions).to.include({ reject: false, recommend: false });
  });

  it("a pushed hard NO rejects in one click with CREDIT_POLICY, no note", async () => {
    const ced = cedula();
    const app = await application(ced);
    await reviewer.assignApplication({ id: app.id });

    const panel = await reviewer.ingestCreditReport(push(ced, delinquent));
    expect(panel.decision!.outcome).to.equal("REJECT");
    expect(panel.decision!.reasons.map((r) => r.code)).to.deep.equal([
      "PCLOUD_DELINQUENT",
      "PCLOUD_UNCOLLECTIBLE"
    ]);
    expect(panel.actions.hardNoReason).to.equal("CREDIT_POLICY");
    expect(panel.previousScore).to.be.a("number");

    const closed = await reviewer.rejectApplication({
      id: app.id,
      reason: "CREDIT_POLICY",
      via: "extension"
    });
    expect(closed.status).to.equal("REJECTED");
    expect(closed.decisionNote).to.equal("PCLOUD_DELINQUENT, PCLOUD_UNCOLLECTIBLE");

    const [event] = await db.businessEvent.findMany({ where: { type: "application.rejected" } });
    const payload = payloadOf(event);
    expect(payload.via).to.equal("extension");
    expect(payload.reason).to.equal("CREDIT_POLICY");
    expect(payload.credit.outcome).to.equal("REJECT");
    expect(event.summary).to.contain("desde la extensión");
  });

  it("CREDIT_POLICY is refused without a hard NO", async () => {
    const ced = cedula();
    const app = await application(ced);
    await reviewer.assignApplication({ id: app.id });
    await reviewer.ingestCreditReport(push(ced, clean));
    await rejected(
      reviewer.rejectApplication({ id: app.id, reason: "CREDIT_POLICY" }),
      "PRECONDITION_FAILED",
      "CREDIT_POLICY_NOT_REJECTED"
    );
  });

  it("only a checked hard NO blocks the admin's approval; missing lookups never do", async () => {
    // No lookups at all: approvable.
    const free = await application(cedula());
    await readyForDecision(free.id);
    const approved = await admin.approveApplication({
      id: free.id,
      approvedAmount: 10000,
      approvedTermWeeks: 12
    });
    expect(approved.status).to.equal("APPROVED");
    const [ev] = await db.businessEvent.findMany({ where: { type: "application.approved" } });
    expect(payloadOf(ev).credit.outcome).to.not.equal("REJECT");

    // A hard NO pushed while it waits for the admin: blocked, no override.
    const ced = cedula();
    const blocked = await application(ced);
    await readyForDecision(blocked.id);
    await reviewer.ingestCreditReport(push(ced, delinquent));
    await rejected(
      admin.approveApplication({ id: blocked.id, approvedAmount: 10000, approvedTermWeeks: 12 }),
      "PRECONDITION_FAILED",
      "CREDIT_POLICY_BLOCKED"
    );
    expect((await db.loanApplication.findUnique({ where: { id: blocked.id } }))!.status).to.equal(
      "PENDING_DECISION"
    );
  });

  it("reports stay with the cédula; mismatched applications and non-reviewers are refused", async () => {
    const ced = cedula();
    // No application yet: stored with the cédula only.
    const panel = await reviewer.ingestCreditReport(push(ced, delinquent));
    expect(panel.application).to.equal(null);
    // A later application for the same person picks the report up.
    const app = await application(ced);
    await reviewer.assignApplication({ id: app.id });
    const later = await reviewer.getCreditPanel({ cedula: ced });
    expect(later.decision!.outcome).to.equal("REJECT");
    expect((await reviewer.listCreditReports({ cedula: ced })).length).to.equal(1);

    const otherApp = await application(cedula());
    await rejected(
      reviewer.ingestCreditReport(push(ced, clean, otherApp.id)),
      "BAD_REQUEST",
      "CEDULA_MISMATCH"
    );
    await rejected(collector.ingestCreditReport(push(ced, clean)), "FORBIDDEN");
  });
});
