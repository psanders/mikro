/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Unified search finds past loan applications for admins AND reviewers by name,
 * phone or cédula — and never DRAFT or ABANDONED ones (openspec add-loan-renewal).
 */
import { expect } from "chai";
import { appRouter } from "../../src/trpc/routers/index.js";
import { createTestDb, applySchema, type TestDb } from "./setup.js";

type Role = "ADMIN" | "COLLECTOR" | "REVIEWER";
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const STATUSES = [
  "DRAFT",
  "RECEIVED",
  "IN_REVIEW",
  "PENDING_DECISION",
  "APPROVED",
  "CONVERTED",
  "REJECTED",
  "ABANDONED"
] as const;

describe("unified search: applications", () => {
  let db: TestDb;
  const as = (roles: Role[]) =>
    appRouter.createCaller({ db: db as any, isAuthenticated: true, userId: ADMIN_ID, roles });

  before(async () => {
    db = createTestDb();
    await applySchema(db);
  });

  beforeEach(async () => {
    await db.loanApplication.deleteMany();
    await db.customer.deleteMany();
    await db.userRole.deleteMany();
    await db.user.deleteMany();
    await db.user.create({ data: { id: ADMIN_ID, name: "Pedro", phone: "+18095550001" } });
  });

  after(async () => {
    await db.$disconnect();
  });

  /** One application per status, all for the same person. */
  async function seedOnePerStatus() {
    for (const [i, status] of STATUSES.entries()) {
      await db.loanApplication.create({
        data: {
          sessionId: `session-${i}`,
          status,
          firstName: "Juan",
          lastName: "Pérez",
          businessName: "Colmado Juan",
          phone: "+18095550142",
          idNumber: "031-0567812-4",
          rawData: {},
          createdAt: new Date(2026, 5, 1 + i)
        }
      });
    }
  }

  it("returns every status worth finding and never DRAFT or ABANDONED, even on an exact cédula", async () => {
    await seedOnePerStatus();
    for (const query of ["juan per", "03105678124", "809 555 0142"]) {
      const r = await as(["ADMIN"]).searchAll({ query, limitPerGroup: 20 });
      const statuses = r.applications.map((a) => a.status);
      expect(statuses, query).to.have.members([
        "RECEIVED",
        "IN_REVIEW",
        "PENDING_DECISION",
        "APPROVED",
        "CONVERTED",
        "REJECTED"
      ]);
      expect(statuses).to.not.include("DRAFT");
      expect(statuses).to.not.include("ABANDONED");
    }
  });

  it("works the same for a reviewer", async () => {
    await seedOnePerStatus();
    const r = await as(["REVIEWER"]).searchAll({ query: "perez", limitPerGroup: 20 });
    expect(r.applications).to.have.length(6);
    expect(r.applications[0]).to.include.keys([
      "id",
      "firstName",
      "lastName",
      "status",
      "createdAt"
    ]);
  });

  it("lists the newest first and honours the per-group cap", async () => {
    await seedOnePerStatus();
    const r = await as(["ADMIN"]).searchAll({ query: "juan", limitPerGroup: 2 });
    expect(r.applications).to.have.length(2);
    expect(r.applications[0].createdAt.getTime()).to.be.greaterThan(
      r.applications[1].createdAt.getTime()
    );
  });

  it("finds nothing for someone else", async () => {
    await seedOnePerStatus();
    const r = await as(["ADMIN"]).searchAll({ query: "maria lopez", limitPerGroup: 20 });
    expect(r.applications).to.have.length(0);
  });

  it("lists a customer's past applications by link or shared cédula, never DRAFT or ABANDONED", async () => {
    const collector = await db.user.create({
      data: { name: "Cobrador", phone: "+18095550002" }
    });
    const customer = await db.customer.create({
      data: {
        name: "Juan Pérez",
        phone: "18095550142",
        idNumber: "031-0567812-4",
        homeAddress: "Calle 1",
        assignedCollectorId: collector.id
      }
    });
    await seedOnePerStatus();
    await db.loanApplication.updateMany({
      where: { sessionId: "session-5" },
      data: { customerId: customer.id, idNumber: null }
    });
    await db.loanApplication.create({
      data: {
        sessionId: "other",
        status: "RECEIVED",
        firstName: "Otra",
        idNumber: "001-0000001-9",
        rawData: {}
      }
    });

    const rows = await as(["REVIEWER"]).listApplicationsByCustomer({ customerId: customer.id });
    // Linked (session-5, CONVERTED) + the five others sharing the cédula; no DRAFT/ABANDONED/other.
    expect(rows.map((r) => r.status)).to.have.members([
      "RECEIVED",
      "IN_REVIEW",
      "PENDING_DECISION",
      "APPROVED",
      "CONVERTED",
      "REJECTED"
    ]);
    expect(rows.every((r) => r.firstName !== "Otra")).to.equal(true);
    expect(rows[0].createdAt.getTime()).to.be.greaterThan(
      rows[rows.length - 1].createdAt.getTime()
    );
  });

  it("still rejects collectors", async () => {
    try {
      await as(["COLLECTOR"]).searchAll({ query: "juan" });
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as { code?: string }).code).to.equal("FORBIDDEN");
    }
  });
});
