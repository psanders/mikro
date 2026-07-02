/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Integration tests for the founder feed: event producers (captured at the tRPC
 * boundary by the event middleware after a successful mutation), the cursor-paged
 * feed, restore-from-snapshot, universal search, audit CSV export, and admin-only
 * authorization.
 */
import { expect } from "chai";
import { ValidationError, businessEventTypeEnum } from "@mikro/common";
import {
  createTestDb,
  createAuthenticatedCaller,
  applySchema,
  type TestDb,
  type AuthenticatedCaller
} from "./setup.js";
import { appRouter } from "../../src/trpc/index.js";
import { recordEvent } from "../../src/api/events/recordEvent.js";
import { eventMappers } from "../../src/api/events/mappers.js";

describe("Founder Feed Integration", () => {
  let db: TestDb;
  let caller: AuthenticatedCaller;
  let phoneSeq = 0;
  const uniquePhone = () => {
    phoneSeq += 1;
    return `+1809${String(10_000_000 + phoneSeq).slice(1)}`;
  };

  /** A COLLECTOR (non-admin) caller for authorization tests. */
  const nonAdminCaller = () =>
    appRouter.createCaller({
      db: db as any,
      isAuthenticated: true,
      userId: "11111111-1111-4111-8111-111111111111",
      roles: ["COLLECTOR"]
    });

  before(async () => {
    db = createTestDb();
    await applySchema(db);
  });

  beforeEach(async () => {
    await db.businessEvent.deleteMany();
    await db.followUpJob.deleteMany();
    await db.loanApplication.deleteMany();
    await db.loanNote.deleteMany();
    await db.payment.deleteMany();
    await db.loan.deleteMany();
    await db.customer.deleteMany();
    await db.userRole.deleteMany();
    await db.user.deleteMany();
    caller = createAuthenticatedCaller(db);
  });

  after(async () => {
    await db.$disconnect();
  });

  async function makeCustomerWithLoan() {
    const collector = await caller.createUser({
      name: "María Collector",
      phone: uniquePhone(),
      role: "COLLECTOR"
    });
    const customer = await caller.createCustomer({
      name: "Juana Pérez",
      phone: uniquePhone(),
      idNumber: `001-${String(Date.now()).slice(-7)}-9`,
      collectionPoint: "https://example.com/p",
      homeAddress: "Calle 1",
      assignedCollectorId: collector.id
    });
    const loan = await caller.createLoan({
      customerId: customer.id,
      principal: 5000,
      termLength: 10,
      paymentAmount: 650,
      paymentFrequency: "WEEKLY",
      startingDate: new Date()
    });
    return { collector, customer, loan };
  }

  async function makeApplication(overrides: Record<string, unknown> = {}) {
    return db.loanApplication.create({
      data: {
        sessionId: `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        status: "RECEIVED",
        source: "MANUAL",
        firstName: "Pedro",
        lastName: "Martínez",
        phone: uniquePhone(),
        idNumber: "001-1234567-8",
        homeAddress: "Calle 2",

        rawData: { any: "thing" } as any,
        ...overrides
      }
    });
  }

  const tinyPdfBase64 = Buffer.from("%PDF-1.4 test contract").toString("base64");

  // ---------------------------------------------------------------------------
  // 6.1 Producers
  // ---------------------------------------------------------------------------

  describe("producers write events at the tRPC boundary", () => {
    it("payment.collected on createPayment", async () => {
      const { collector, customer, loan } = await makeCustomerWithLoan();
      await caller.createPayment({ loanId: loan.loanId, amount: 650, collectedById: collector.id });

      const events = await db.businessEvent.findMany({ where: { type: "payment.collected" } });
      expect(events).to.have.lengthOf(1);
      const e = events[0];
      expect(e.actorId).to.equal(collector.id);
      expect(e.actorName).to.equal("María Collector");
      expect(e.customerId).to.equal(customer.id);
      expect(e.customerName).to.equal("Juana Pérez");
      expect(e.loanId).to.equal(loan.id);
      expect(Number(e.amount)).to.equal(650);
      expect(e.summary).to.contain("cobró RD$ 650");
      const payload = JSON.parse(e.payload);
      expect(payload.paymentId).to.be.a("string");
      expect(payload.kind).to.equal("INSTALLMENT");
    });

    it("payment.reversed on reversePayment", async () => {
      const { collector, loan } = await makeCustomerWithLoan();
      const res = await caller.createPayment({
        loanId: loan.loanId,
        amount: 650,
        collectedById: collector.id
      });
      await caller.reversePayment({ id: res.installment!.id, notes: "error de captura" });

      const events = await db.businessEvent.findMany({ where: { type: "payment.reversed" } });
      expect(events).to.have.lengthOf(1);
      expect(Number(events[0].amount)).to.equal(650);
      expect(events[0].summary).to.contain("revirtió");
      expect(JSON.parse(events[0].payload).reason).to.equal("error de captura");
    });

    it("application.approved on approveApplication (policyException false)", async () => {
      const app = await makeApplication();
      await caller.approveApplication({ id: app.id, note: "ok" });

      const events = await db.businessEvent.findMany({ where: { type: "application.approved" } });
      expect(events).to.have.lengthOf(1);
      expect(events[0].applicationId).to.equal(app.id);
      expect(events[0].summary).to.contain("aprobada");
      expect(JSON.parse(events[0].payload).policyException).to.equal(false);
    });

    it("application.rejected on rejectApplication", async () => {
      const app = await makeApplication();
      await caller.rejectApplication({ id: app.id, reason: "no califica" });

      const events = await db.businessEvent.findMany({ where: { type: "application.rejected" } });
      expect(events).to.have.lengthOf(1);
      expect(events[0].summary).to.contain("rechazada");
    });

    it("application.signed on uploadSignedContract", async () => {
      const app = await makeApplication({ status: "APPROVED" });
      await caller.uploadSignedContract({
        id: app.id,
        originalName: "contrato.pdf",
        mimeType: "application/pdf",
        dataBase64: tinyPdfBase64
      });

      const events = await db.businessEvent.findMany({ where: { type: "application.signed" } });
      expect(events).to.have.lengthOf(1);
      expect(events[0].applicationId).to.equal(app.id);
    });

    it("application.converted on convertApplication", async () => {
      const app = await makeApplication({
        status: "SIGNED",
        idNumber: "001-7654321-0",
        phone: uniquePhone()
      });
      await caller.convertApplication({
        id: app.id,
        principal: 5000,
        termLength: 10,
        paymentAmount: 650,
        paymentFrequency: "WEEKLY"
      });

      const converted = await db.businessEvent.findMany({
        where: { type: "application.converted" }
      });
      expect(converted).to.have.lengthOf(1);
      expect(Number(converted[0].amount)).to.equal(5000);
      expect(converted[0].applicationId).to.equal(app.id);
      expect(converted[0].loanId).to.be.a("string");
      expect(JSON.parse(converted[0].payload).loanNumber).to.be.a("number");

      // The customer created *inside* the convert transaction is an internal
      // function call, not a tRPC mutation, so boundary capture does not emit a
      // separate customer.created event — the converted card already covers it.
      const created = await db.businessEvent.findMany({ where: { type: "customer.created" } });
      expect(created).to.have.lengthOf(0);
    });

    it("application.deleted with a full snapshot on deleteApplication", async () => {
      const app = await makeApplication({ requestedAmount: 5000 });
      await caller.deleteApplication({ id: app.id });

      const events = await db.businessEvent.findMany({ where: { type: "application.deleted" } });
      expect(events).to.have.lengthOf(1);
      const payload = JSON.parse(events[0].payload);
      expect(payload.snapshot.id).to.equal(app.id);
      expect(payload.snapshot.sessionId).to.equal(app.sessionId);
      // Decimal serialized to number, dates to ISO strings.
      expect(payload.snapshot.requestedAmount).to.equal(5000);
      expect(payload.snapshot.createdAt).to.be.a("string");
      // The application row is really gone.
      const still = await db.loanApplication.findUnique({ where: { id: app.id } });
      expect(still).to.equal(null);
    });

    it("loan.status_changed on updateLoanStatus", async () => {
      const { loan } = await makeCustomerWithLoan();
      await caller.updateLoanStatus({ loanId: loan.loanId, status: "COMPLETED" });

      const events = await db.businessEvent.findMany({ where: { type: "loan.status_changed" } });
      expect(events).to.have.lengthOf(1);
      expect(events[0].loanId).to.equal(loan.id);
      const payload = JSON.parse(events[0].payload);
      // `from` (the prior status) is not observable at the tRPC boundary after
      // the mutation commits (see loanStatusChanged mapper); `to` is authoritative.
      expect(payload).to.have.property("from");
      expect(payload.to).to.equal("COMPLETED");
    });

    it("customer.created on createCustomer", async () => {
      const collector = await caller.createUser({
        name: "Ana",
        phone: uniquePhone(),
        role: "COLLECTOR"
      });
      const customer = await caller.createCustomer({
        name: "Nuevo Cliente",
        phone: uniquePhone(),
        idNumber: `001-${String(Date.now()).slice(-7)}-1`,
        collectionPoint: "https://example.com/p",
        homeAddress: "Calle 3",
        assignedCollectorId: collector.id
      });

      const events = await db.businessEvent.findMany({ where: { type: "customer.created" } });
      expect(events).to.have.lengthOf(1);
      expect(events[0].customerId).to.equal(customer.id);
      expect(events[0].customerName).to.equal("Nuevo Cliente");
    });
  });

  describe("event-capture middleware behavior", () => {
    it("a failed mutation records no event", async () => {
      let thrown: unknown;
      try {
        // No such application → resolver throws before any write.
        await caller.approveApplication({ id: "44444444-4444-4444-8444-444444444444" });
      } catch (err) {
        thrown = err;
      }
      expect(thrown, "expected the mutation to reject").to.not.equal(undefined);
      expect(await db.businessEvent.count()).to.equal(0);
    });

    it("an event-write failure is swallowed and the mutation still succeeds", async () => {
      const collector = await caller.createUser({
        name: "Ana",
        phone: uniquePhone(),
        role: "COLLECTOR"
      });

      // Force the post-commit event write to blow up.

      const create = (db as any).businessEvent.create.bind((db as any).businessEvent);

      (db as any).businessEvent.create = () => Promise.reject(new Error("write boom"));

      let customer: { id: string } | undefined;
      try {
        customer = await caller.createCustomer({
          name: "Resiliente",
          phone: uniquePhone(),
          idNumber: `001-${String(Date.now()).slice(-7)}-3`,
          collectionPoint: "https://example.com/p",
          homeAddress: "Calle 9",
          assignedCollectorId: collector.id
        });
      } finally {
        (db as any).businessEvent.create = create;
      }

      // The mutation committed despite the event-write failure.
      expect(customer!.id).to.be.a("string");
      const persisted = await db.customer.findUnique({ where: { id: customer!.id } });
      expect(persisted).to.not.equal(null);
      // ...and no customer.created event was written.
      expect(await db.businessEvent.count({ where: { type: "customer.created" } })).to.equal(0);
    });
  });

  describe("mapper registry coverage", () => {
    it("registers a mapper for every catalog type except intrinsically-written ones", () => {
      // These are written intrinsically (never by a boundary mapper):
      // application.restored by createRestoreApplication; copilot.action by the
      // copilot confirm flow; rule.alert by the watch-rule evaluator. They must
      // be the only types without a registered mapper.
      const intrinsic = new Set(["application.restored", "copilot.action", "rule.alert"]);
      for (const type of businessEventTypeEnum.options) {
        if (intrinsic.has(type)) {
          expect(eventMappers[type], `${type} should NOT have a mapper`).to.equal(undefined);
        } else {
          expect(eventMappers[type], `${type} must have a registered mapper`).to.be.a("function");
        }
      }
    });
  });

  describe("recordEvent atomicity and validation", () => {
    it("rolls back with the caller's transaction (writes nothing)", async () => {
      try {
        await db.$transaction(async (tx) => {
          await recordEvent(tx, {
            type: "customer.created",
            actorName: "Sistema",
            customerId: "22222222-2222-4222-8222-222222222222",
            summary: "test",
            payload: { customerId: "22222222-2222-4222-8222-222222222222" }
          });
          throw new Error("boom");
        });
        expect.fail("transaction should have thrown");
      } catch (err) {
        expect((err as Error).message).to.equal("boom");
      }
      expect(await db.businessEvent.count()).to.equal(0);
    });

    it("rejects a payload that fails its type schema (structured error, no row)", async () => {
      let thrown: unknown;
      try {
        await recordEvent(db, {
          type: "payment.collected",
          actorName: "Sistema",
          summary: "bad",
          // Missing required paymentId/method/kind for payment.collected.
          payload: { nope: true }
        });
      } catch (err) {
        thrown = err;
      }
      expect(thrown).to.be.instanceOf(ValidationError);
      expect(await db.businessEvent.count()).to.equal(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 6.2 Feed / restore / search / export
  // ---------------------------------------------------------------------------

  async function seedEvents(count: number, baseTime = Date.UTC(2026, 0, 1)) {
    for (let i = 0; i < count; i++) {
      await db.businessEvent.create({
        data: {
          type: "customer.created",
          occurredAt: new Date(baseTime + i * 1000),
          actorName: "Sistema",
          summary: `evento ${i}`,
          payload: "{}"
        }
      });
    }
  }

  describe("listFeedEvents", () => {
    it("returns contiguous, non-overlapping pages even with inserts between fetches", async () => {
      await seedEvents(10, Date.UTC(2026, 0, 1));

      const page1 = await caller.listFeedEvents({ limit: 4 });
      expect(page1.items).to.have.lengthOf(4);
      expect(page1.nextCursor).to.be.a("string");
      // Newest first.
      expect(page1.items[0].summary).to.equal("evento 9");

      // New events arrive at the head between page fetches.
      await seedEvents(3, Date.UTC(2026, 5, 1));

      const page2 = await caller.listFeedEvents({ limit: 4, cursor: page1.nextCursor! });
      const ids1 = new Set(page1.items.map((i) => i.id));
      const overlap = page2.items.filter((i) => ids1.has(i.id));
      expect(overlap).to.have.lengthOf(0);
      // Continues strictly older than page1's last item.
      expect(page2.items[0].summary).to.equal("evento 5");
      expect(page2.items.map((i) => i.summary)).to.deep.equal([
        "evento 5",
        "evento 4",
        "evento 3",
        "evento 2"
      ]);
    });

    it("filters by type", async () => {
      await seedEvents(2);
      await db.businessEvent.create({
        data: { type: "payment.collected", actorName: "x", summary: "pago", payload: "{}" }
      });
      const res = await caller.listFeedEvents({ types: ["payment.collected"] });
      expect(res.items).to.have.lengthOf(1);
      expect(res.items[0].type).to.equal("payment.collected");
    });
  });

  describe("restoreApplication", () => {
    it("restores from a deletion snapshot within the window", async () => {
      const app = await makeApplication({ requestedAmount: 5000 });
      await caller.deleteApplication({ id: app.id });
      const del = await db.businessEvent.findFirst({ where: { type: "application.deleted" } });

      const result = await caller.restoreApplication({ deletionEventId: del!.id });
      expect(result.id).to.equal(app.id);

      const restored = await db.loanApplication.findUnique({ where: { id: app.id } });
      expect(restored).to.not.equal(null);
      expect(restored!.sessionId).to.equal(app.sessionId);
      expect(await db.businessEvent.count({ where: { type: "application.restored" } })).to.equal(1);
    });

    it("rejects restore after the 30-day window (no row created)", async () => {
      const app = await makeApplication();
      const snapshot = {
        ...app,
        createdAt: app.createdAt.toISOString(),
        updatedAt: app.updatedAt.toISOString(),
        rawData: { any: "thing" }
      };
      await db.loanApplication.delete({ where: { id: app.id } });
      const del = await db.businessEvent.create({
        data: {
          type: "application.deleted",
          occurredAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
          actorName: "Sistema",
          applicationId: app.id,
          summary: "old",
          payload: JSON.stringify({ applicationId: app.id, snapshot })
        }
      });

      let thrown: unknown;
      try {
        await caller.restoreApplication({ deletionEventId: del.id });
      } catch (err) {
        thrown = err;
      }
      expect(thrown).to.not.equal(undefined);
      expect(await db.loanApplication.findUnique({ where: { id: app.id } })).to.equal(null);
      expect(await db.businessEvent.count({ where: { type: "application.restored" } })).to.equal(0);
    });

    it("rejects restore when the sessionId is already in use (no partial writes)", async () => {
      const app = await makeApplication();
      await caller.deleteApplication({ id: app.id });
      const del = await db.businessEvent.findFirst({ where: { type: "application.deleted" } });
      // A new application grabs the same sessionId before restore.
      await makeApplication({ sessionId: app.sessionId });

      let thrown: unknown;
      try {
        await caller.restoreApplication({ deletionEventId: del!.id });
      } catch (err) {
        thrown = err;
      }
      expect(thrown).to.not.equal(undefined);
      expect(await db.loanApplication.findUnique({ where: { id: app.id } })).to.equal(null);
      expect(await db.businessEvent.count({ where: { type: "application.restored" } })).to.equal(0);
    });
  });

  describe("searchAll", () => {
    it("groups matching customers, loans, and events", async () => {
      const { customer, loan } = await makeCustomerWithLoan();
      await db.businessEvent.create({
        data: {
          type: "payment.collected",
          actorName: "María Collector",
          customerName: "Juana Pérez",
          summary: "María cobró RD$ 650 a Juana Pérez",
          payload: "{}"
        }
      });

      const res = await caller.searchAll({ query: "Juana" });
      expect(res.customers.map((c) => c.id)).to.include(customer.id);
      expect(res.loans.map((l) => l.id)).to.include(loan.id);
      expect(res.events.length).to.be.greaterThan(0);

      // Loan lookup by numeric loan id.
      const byNumber = await caller.searchAll({ query: String(loan.loanId) });
      expect(byNumber.loans.map((l) => l.id)).to.include(loan.id);
    });

    it("caps each group at limitPerGroup", async () => {
      for (let i = 0; i < 6; i++) {
        await db.businessEvent.create({
          data: { type: "customer.created", actorName: "Zeta", summary: `Zeta ${i}`, payload: "{}" }
        });
      }
      const res = await caller.searchAll({ query: "Zeta", limitPerGroup: 2 });
      expect(res.events).to.have.lengthOf(2);
    });
  });

  describe("exportAuditLog", () => {
    it("exports a month of events as CSV with a header row", async () => {
      await db.businessEvent.create({
        data: {
          type: "payment.collected",
          occurredAt: new Date(Date.UTC(2026, 2, 10)),
          actorName: "María",
          customerName: "Juana, la clienta",
          summary: 'Contiene "comillas" y coma,',
          amount: 650,
          payload: "{}"
        }
      });
      // Different month — must be excluded.
      await db.businessEvent.create({
        data: {
          type: "customer.created",
          occurredAt: new Date(Date.UTC(2026, 3, 1)),
          actorName: "x",
          summary: "abril",
          payload: "{}"
        }
      });

      const res = await caller.exportAuditLog({ year: 2026, month: 3 });
      expect(res.filename).to.equal("registro-auditoria-2026-03.csv");
      const lines = res.csv.split("\r\n");
      expect(lines[0]).to.equal(
        "occurredAt,type,actorName,customerName,loanId,applicationId,amount,summary"
      );
      expect(lines).to.have.lengthOf(2);
      // RFC-4180 quoting of comma + doubled quotes.
      expect(lines[1]).to.contain('"Juana, la clienta"');
      expect(lines[1]).to.contain('"Contiene ""comillas"" y coma,"');
      expect(lines[1]).to.contain("650");
    });

    it("produces headers only for an empty month", async () => {
      const res = await caller.exportAuditLog({ year: 2030, month: 1 });
      expect(res.csv).to.equal(
        "occurredAt,type,actorName,customerName,loanId,applicationId,amount,summary"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 6.3 Authorization
  // ---------------------------------------------------------------------------

  describe("admin-only authorization", () => {
    async function expectForbidden(promise: Promise<unknown>) {
      let thrown: { code?: string } | undefined;
      try {
        await promise;
      } catch (err) {
        thrown = err as { code?: string };
      }
      expect(thrown, "expected a rejection").to.not.equal(undefined);
      expect(thrown!.code).to.equal("FORBIDDEN");
    }

    it("rejects non-admin callers on feed/search/export/restore", async () => {
      const c = nonAdminCaller();
      await expectForbidden(c.listFeedEvents({}));
      await expectForbidden(c.searchAll({ query: "x" }));
      await expectForbidden(c.exportAuditLog({ year: 2026, month: 1 }));
      await expectForbidden(
        c.restoreApplication({ deletionEventId: "33333333-3333-4333-8333-333333333333" })
      );
    });
  });
});
