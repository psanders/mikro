/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Integration tests for copilot watch rules (task 5.2): CRUD, the three v1
 * metric computations against seeded data, and the evaluator's state-change
 * semantics (one rule.alert per ok→breached crossing; none while still breached
 * or disabled; a recovered rule alerts again on re-breach).
 */
import { expect } from "chai";
import {
  createTestDb,
  createAuthenticatedCaller,
  applySchema,
  type TestDb,
  type AuthenticatedCaller
} from "./setup.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import {
  createWatchRule,
  listWatchRules,
  disableWatchRule,
  computeWatchMetric,
  evaluateWatchRules
} from "../../src/api/copilot/index.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("Copilot Watch Rules Integration", () => {
  let db: TestDb;
  let caller: AuthenticatedCaller;
  let seq = 0;
  const uniquePhone = () => {
    seq += 1;
    return `+1809${String(10_000_000 + seq).slice(1)}`;
  };
  const FOUNDER_ID = "00000000-0000-4000-8000-000000000001";

  before(async () => {
    db = createTestDb();
    await applySchema(db);
  });

  beforeEach(async () => {
    await db.copilotPendingAction.deleteMany();
    await db.watchRule.deleteMany();
    await db.businessEvent.deleteMany();
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

  const prisma = () => db as unknown as PrismaClient;

  async function makeCollectorAndCustomer(collectorId?: string) {
    const collector = await caller.createUser({
      name: "Cobrador",
      phone: uniquePhone(),
      role: "COLLECTOR"
    });
    const customer = await caller.createCustomer({
      name: "Cliente",
      phone: uniquePhone(),
      idNumber: `001-${String(Date.now()).slice(-7)}-9`,
      collectionPoint: "https://example.com/p",
      homeAddress: "Calle 1",
      assignedCollectorId: collectorId ?? collector.id
    });
    return { collector, customer };
  }

  let loanSeq = 10000;
  async function makeLoan(customerId: string, startingDate: Date, status = "ACTIVE") {
    loanSeq += 1;
    return db.loan.create({
      data: {
        loanId: loanSeq,
        principal: 5000,
        termLength: 10,
        paymentAmount: 650,
        paymentFrequency: "WEEKLY",
        status: status as any,
        startingDate,
        customerId
      }
    });
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  describe("CRUD", () => {
    it("creates, lists, and disables a rule", async () => {
      const rule = await createWatchRule(
        prisma(),
        { name: "Mora alta", metric: "mora_pct_portfolio", comparator: "gt", threshold: 20 },
        FOUNDER_ID
      );
      expect(rule.enabled).to.equal(true);
      expect(rule.metric).to.equal("mora_pct_portfolio");

      const active = await listWatchRules(prisma(), {});
      expect(active).to.have.lengthOf(1);

      await disableWatchRule(prisma(), rule.id);

      expect(await listWatchRules(prisma(), {})).to.have.lengthOf(0);
      expect(await listWatchRules(prisma(), { includeDisabled: true })).to.have.lengthOf(1);
    });

    it("refuses an invalid metric", async () => {
      let threw = false;
      try {
        await createWatchRule(
          prisma(),
          { name: "x", metric: "bogus_metric", comparator: "gt", threshold: 1 },
          FOUNDER_ID
        );
      } catch {
        threw = true;
      }
      expect(threw).to.equal(true);
      expect(await db.watchRule.count()).to.equal(0);
    });

    it("requires a collectorId for mora_pct_collector", async () => {
      let threw = false;
      try {
        await createWatchRule(
          prisma(),
          { name: "x", metric: "mora_pct_collector", comparator: "gt", threshold: 1 },
          FOUNDER_ID
        );
      } catch (err) {
        threw = true;
        expect((err as Error).message).to.match(/collectorId/i);
      }
      expect(threw).to.equal(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Metrics
  // ---------------------------------------------------------------------------

  describe("metric computations", () => {
    it("mora_pct_portfolio = share of active loans that are overdue", async () => {
      const { customer } = await makeCollectorAndCustomer();
      const asOf = new Date();
      // Overdue: started 30 days ago, no payments → several missed cycles.
      await makeLoan(customer.id, new Date(asOf.getTime() - 30 * DAY_MS));
      // Not overdue: starts today → 0 elapsed cycles.
      await makeLoan(customer.id, asOf);

      const value = await computeWatchMetric(prisma(), { metric: "mora_pct_portfolio" }, asOf);
      expect(value).to.equal(50);
    });

    it("mora_pct_collector scopes to the collector's customers", async () => {
      const asOf = new Date();
      const a = await makeCollectorAndCustomer();
      const b = await makeCollectorAndCustomer();
      // Collector A: one overdue loan → 100%.
      await makeLoan(a.customer.id, new Date(asOf.getTime() - 30 * DAY_MS));
      // Collector B: one healthy loan → would dilute portfolio but not A's scope.
      await makeLoan(b.customer.id, asOf);

      const scoped = await computeWatchMetric(
        prisma(),
        { metric: "mora_pct_collector", collectorId: a.collector.id },
        asOf
      );
      expect(scoped).to.equal(100);

      const portfolio = await computeWatchMetric(prisma(), { metric: "mora_pct_portfolio" }, asOf);
      expect(portfolio).to.equal(50);
    });

    it("cobranza_diaria sums today's non-reversed payments", async () => {
      const { collector, customer } = await makeCollectorAndCustomer();
      const asOf = new Date();
      const loan = await makeLoan(customer.id, asOf);

      // Two payments today (count), one reversed today (skip), one yesterday (skip).
      await db.payment.create({
        data: { amount: 650, paidAt: asOf, loanId: loan.id, collectedById: collector.id }
      });
      await db.payment.create({
        data: { amount: 350, paidAt: asOf, loanId: loan.id, collectedById: collector.id }
      });
      await db.payment.create({
        data: {
          amount: 999,
          paidAt: asOf,
          status: "REVERSED",
          loanId: loan.id,
          collectedById: collector.id
        }
      });
      await db.payment.create({
        data: {
          amount: 500,
          paidAt: new Date(asOf.getTime() - DAY_MS),
          loanId: loan.id,
          collectedById: collector.id
        }
      });

      const value = await computeWatchMetric(prisma(), { metric: "cobranza_diaria" }, asOf);
      expect(value).to.equal(1000);
    });
  });

  // ---------------------------------------------------------------------------
  // Evaluator state-change semantics
  // ---------------------------------------------------------------------------

  describe("evaluator", () => {
    async function seedBreachedPortfolio() {
      const { customer } = await makeCollectorAndCustomer();
      // 50% mora (one overdue, one healthy).
      await makeLoan(customer.id, new Date(Date.now() - 30 * DAY_MS));
      await makeLoan(customer.id, new Date());
      return customer;
    }

    it("emits exactly one rule.alert per ok→breached crossing", async () => {
      await seedBreachedPortfolio();
      const rule = await createWatchRule(
        prisma(),
        { name: "Mora > 40%", metric: "mora_pct_portfolio", comparator: "gt", threshold: 40 },
        FOUNDER_ID
      );

      const first = await evaluateWatchRules(prisma());
      expect(first.alerts).to.equal(1);

      // Still breached — a second pass must NOT re-alert.
      const second = await evaluateWatchRules(prisma());
      expect(second.alerts).to.equal(0);

      expect(await db.businessEvent.count({ where: { type: "rule.alert" } })).to.equal(1);
      const refreshed = await db.watchRule.findUnique({ where: { id: rule.id } });
      expect(refreshed?.lastState).to.equal("breached");
      expect(refreshed?.lastEvaluatedAt).to.not.equal(null);
    });

    it("re-alerts after recovering and breaching again", async () => {
      await seedBreachedPortfolio();
      await createWatchRule(
        prisma(),
        { name: "Mora > 40%", metric: "mora_pct_portfolio", comparator: "gt", threshold: 40 },
        FOUNDER_ID
      );

      expect((await evaluateWatchRules(prisma())).alerts).to.equal(1);

      // Recover: clear all loans → 0% mora → ok.
      await db.loan.deleteMany();
      expect((await evaluateWatchRules(prisma())).alerts).to.equal(0);

      // Breach again.
      await seedBreachedPortfolio();
      expect((await evaluateWatchRules(prisma())).alerts).to.equal(1);

      expect(await db.businessEvent.count({ where: { type: "rule.alert" } })).to.equal(2);
    });

    it("skips disabled rules entirely", async () => {
      await seedBreachedPortfolio();
      const rule = await createWatchRule(
        prisma(),
        { name: "Mora > 40%", metric: "mora_pct_portfolio", comparator: "gt", threshold: 40 },
        FOUNDER_ID
      );
      await disableWatchRule(prisma(), rule.id);

      const result = await evaluateWatchRules(prisma());
      expect(result.evaluated).to.equal(0);
      expect(result.alerts).to.equal(0);
      expect(await db.businessEvent.count({ where: { type: "rule.alert" } })).to.equal(0);

      // Disabled rule was never touched.
      const refreshed = await db.watchRule.findUnique({ where: { id: rule.id } });
      expect(refreshed?.lastEvaluatedAt).to.equal(null);
    });
  });
});
