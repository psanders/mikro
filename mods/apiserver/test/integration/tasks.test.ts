/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Founder-task worker integration: firing lifecycle against a real in-memory
 * database. Covers the fire→READY path with its task.due event, gathering
 * failure → NEEDS_INPUT, auto-gate execution posting a real accounting
 * transaction, open-firing suppression, fire-late collapse after downtime,
 * once-task disable, and the unknown-automation degrade.
 */
import { expect } from "chai";
import { createTestDb, applySchema, type TestDb } from "./setup.js";
import { processDueTasks } from "../../src/tasks/processDueTasks.js";
import { executeFiring, skipFiring } from "../../src/tasks/firings.js";

const FOUNDER_ID = "00000000-0000-4000-8000-000000000001";

describe("Founder Tasks Integration", () => {
  let db: TestDb;
  let accountId: string;
  let categoryId: string;
  let collectorId: string;

  beforeEach(async () => {
    db = createTestDb();
    await applySchema(db);

    await db.user.create({
      data: { id: FOUNDER_ID, name: "Pedro S.", phone: "+18095550001" }
    });
    const collector = await db.user.create({
      data: { name: "Luis M.", phone: "+18095550002" }
    });
    collectorId = collector.id;

    const account = await db.accountingAccount.create({
      data: { name: "Caja principal", kind: "CASH", currentBalance: 50_000 }
    });
    accountId = account.id;

    const category = await db.accountingCategory.create({
      data: { name: "Comisiones", kind: "EXPENSE" }
    });
    categoryId = category.id;
  });

  afterEach(async () => {
    await db.$disconnect();
  });

  function makeTask(overrides: Record<string, unknown> = {}) {
    return db.task.create({
      data: {
        name: "Pago semanal — Luis M.",
        automationId: "pay-collector",
        frequency: "weekly",
        weekday: 5,
        timeOfDay: "08:00",
        staticParamsJson: JSON.stringify({ collectorId, accountId, categoryId }),
        gate: "confirm",
        nextFireAt: new Date(Date.now() - 60_000),
        createdById: FOUNDER_ID,
        ...overrides
      }
    });
  }

  it("fires a due confirm-gated task: READY firing + task.due event + advanced schedule", async () => {
    const task = await makeTask();
    const result = await processDueTasks(db);

    expect(result.fired).to.equal(1);
    const firing = await db.taskFiring.findFirstOrThrow({ where: { taskId: task.id } });
    expect(firing.status).to.equal("READY");
    const payload = JSON.parse(firing.payloadJson);
    expect(payload.collectorId).to.equal(collectorId);
    const context = JSON.parse(firing.contextJson!);
    expect(context.collectorName).to.equal("Luis M.");

    const event = await db.businessEvent.findFirstOrThrow({ where: { type: "task.due" } });
    expect(JSON.parse(event.payload).taskFiringId).to.equal(firing.id);

    const updated = await db.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.nextFireAt!.getTime()).to.be.greaterThan(Date.now());
  });

  it("degrades to NEEDS_INPUT with its event when a static slot is missing", async () => {
    await makeTask({ staticParamsJson: JSON.stringify({ collectorId }) });
    const result = await processDueTasks(db);

    expect(result.needsInput).to.equal(1);
    const firing = await db.taskFiring.findFirstOrThrow({});
    expect(firing.status).to.equal("NEEDS_INPUT");
    expect(JSON.parse(firing.missingSlotsJson!)).to.include.members(["accountId", "categoryId"]);
    expect(await db.businessEvent.count({ where: { type: "task.needs_input" } })).to.equal(1);
  });

  it("executes an auto-gated firing in place, posting the transaction", async () => {
    // Worker-level check: v1 automations all have a confirm floor, so the row
    // is inserted with gate auto directly (create-time validation is the
    // API's job, exercised in group 4 tests).
    await makeTask({
      automationId: "daily-close",
      name: "Cierre contable del día",
      frequency: "daily",
      weekday: null,
      gate: "auto",
      staticParamsJson: JSON.stringify({ accountId })
    });

    const result = await processDueTasks(db);
    expect(result.executed).to.equal(1);

    const firing = await db.taskFiring.findFirstOrThrow({});
    // No payments seeded → zero day, still DONE without posting.
    expect(firing.status).to.equal("DONE");
    expect(await db.businessEvent.count({ where: { type: "task.completed" } })).to.equal(1);
  });

  it("never stacks firings: an open firing suppresses re-firing but the schedule advances", async () => {
    const task = await makeTask();
    await processDueTasks(db);

    // Force the task due again while the firing is still open.
    await db.task.update({
      where: { id: task.id },
      data: { nextFireAt: new Date(Date.now() - 1000) }
    });
    const second = await processDueTasks(db);

    expect(second.fired).to.equal(0);
    expect(await db.taskFiring.count({ where: { taskId: task.id } })).to.equal(1);
    const updated = await db.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.nextFireAt!.getTime()).to.be.greaterThan(Date.now());
  });

  it("collapses long downtime into a single late firing", async () => {
    // Three missed weeks ago.
    const task = await makeTask({
      nextFireAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
    });
    const result = await processDueTasks(db);

    expect(result.fired).to.equal(1);
    const updated = await db.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.nextFireAt!.getTime()).to.be.greaterThan(Date.now());
  });

  it("disables a once task after firing", async () => {
    const task = await makeTask({
      frequency: "once",
      weekday: null,
      onDate: "2026-07-01"
    });
    await processDueTasks(db);

    const updated = await db.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.enabled).to.equal(false);
    expect(updated.nextFireAt).to.equal(null);
  });

  it("surfaces an unknown automation as NEEDS_INPUT instead of crashing", async () => {
    await makeTask({ automationId: "tss-check" });
    const result = await processDueTasks(db);

    expect(result.needsInput).to.equal(1);
    const firing = await db.taskFiring.findFirstOrThrow({});
    expect(firing.reason).to.include("desconocida");
  });

  describe("executeFiring / skipFiring", () => {
    async function readyFiring() {
      await makeTask();
      await processDueTasks(db);
      return db.taskFiring.findFirstOrThrow({ where: { status: "READY" } });
    }

    it("confirm executes the automation and records task.completed with the amount", async () => {
      const firing = await readyFiring();
      const result = await executeFiring(
        db,
        firing,
        { amount: "3500", note: "Pago semana 27" },
        { id: FOUNDER_ID, name: "Pedro S." }
      );

      expect(result.status).to.equal("DONE");
      const txn = await db.accountingTransaction.findFirstOrThrow({});
      expect(Number(txn.amount)).to.equal(3500);
      expect(txn.type).to.equal("EXPENSE");
      expect(txn.description).to.equal("Pago semana 27");

      const account = await db.accountingAccount.findUniqueOrThrow({ where: { id: accountId } });
      expect(Number(account.currentBalance)).to.equal(46_500);

      const event = await db.businessEvent.findFirstOrThrow({ where: { type: "task.completed" } });
      expect(JSON.parse(event.payload).skipped).to.equal(false);
      expect(Number(event.amount)).to.equal(3500);

      const resolved = await db.taskFiring.findUniqueOrThrow({ where: { id: firing.id } });
      expect(resolved.status).to.equal("DONE");
      expect(resolved.resolvedById).to.equal(FOUNDER_ID);
    });

    it("rejects invalid ask values before any side effect and leaves the firing open", async () => {
      const firing = await readyFiring();
      let threw = false;
      try {
        await executeFiring(db, firing, { amount: -10 }, { id: FOUNDER_ID, name: "Pedro S." });
      } catch {
        threw = true;
      }
      expect(threw).to.equal(true);
      expect(await db.accountingTransaction.count()).to.equal(0);
      const still = await db.taskFiring.findUniqueOrThrow({ where: { id: firing.id } });
      expect(still.status).to.equal("READY");
    });

    it("records task.failed when the automation refuses (double close)", async () => {
      await db.task.create({
        data: {
          name: "Cierre contable del día",
          automationId: "daily-close",
          frequency: "daily",
          timeOfDay: "07:00",
          staticParamsJson: JSON.stringify({ accountId }),
          gate: "confirm",
          nextFireAt: new Date(Date.now() - 60_000),
          createdById: FOUNDER_ID
        }
      });
      await processDueTasks(db);
      const firing = await db.taskFiring.findFirstOrThrow({
        where: { automationId: "daily-close" }
      });
      // Pretend the close date was already bridged.
      const closeDate = (JSON.parse(firing.payloadJson) as { closeDate: string }).closeDate;
      await db.accountingTransaction.create({
        data: {
          type: "INCOME",
          amount: 1,
          occurredAt: new Date(),
          reference: `daily-close:${closeDate}:CASH`,
          accountId,
          createdById: FOUNDER_ID
        }
      });

      const result = await executeFiring(db, firing, {}, { id: FOUNDER_ID, name: "Pedro S." });
      expect(result.status).to.equal("FAILED");
      expect(await db.businessEvent.count({ where: { type: "task.failed" } })).to.equal(1);
    });

    it("skip resolves the firing with a skipped task.completed event", async () => {
      const firing = await readyFiring();
      await skipFiring(db, firing, { id: FOUNDER_ID, name: "Pedro S." });

      const resolved = await db.taskFiring.findUniqueOrThrow({ where: { id: firing.id } });
      expect(resolved.status).to.equal("SKIPPED");
      const event = await db.businessEvent.findFirstOrThrow({ where: { type: "task.completed" } });
      expect(JSON.parse(event.payload).skipped).to.equal(true);
      expect(await db.accountingTransaction.count()).to.equal(0);
    });

    it("degrades to NEEDS_INPUT when the stored payload no longer validates (drift)", async () => {
      const firing = await readyFiring();
      await db.taskFiring.update({
        where: { id: firing.id },
        data: { payloadJson: JSON.stringify({ collectorId: "not-a-uuid" }) }
      });
      const stale = await db.taskFiring.findUniqueOrThrow({ where: { id: firing.id } });

      const result = await executeFiring(
        db,
        stale,
        { amount: 3500 },
        {
          id: FOUNDER_ID,
          name: "Pedro S."
        }
      );

      expect(result.status).to.equal("NEEDS_INPUT");
      expect(await db.accountingTransaction.count()).to.equal(0);
      expect(await db.businessEvent.count({ where: { type: "task.needs_input" } })).to.equal(1);
    });
  });
});
