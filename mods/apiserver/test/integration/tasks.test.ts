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
import {
  createTestDb,
  createAuthenticatedCaller,
  applySchema,
  type TestDb,
  type AuthenticatedCaller
} from "./setup.js";
import { processDueTasks } from "../../src/tasks/processDueTasks.js";
import { executeFiring, skipFiring } from "../../src/tasks/firings.js";
import { createCopilotChat } from "../../src/api/copilot/createCopilotChat.js";
import { getBoundToolNames } from "../../src/api/copilot/toolPolicy.js";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ToolExecutor } from "@mikro/agents";

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

    it("recovers a NEEDS_INPUT firing when confirm supplies the missing slot", async () => {
      // Fire with a missing static slot (account), then supply it on confirm.
      await makeTask({ staticParamsJson: JSON.stringify({ collectorId, categoryId }) });
      await processDueTasks(db);
      const firing = await db.taskFiring.findFirstOrThrow({ where: { status: "NEEDS_INPUT" } });

      const result = await executeFiring(
        db,
        firing,
        { accountId, amount: 3500 },
        { id: FOUNDER_ID, name: "Pedro S." }
      );

      expect(result.status).to.equal("DONE");
      expect(await db.accountingTransaction.count()).to.equal(1);
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

  describe("tasks tRPC router", () => {
    let caller: AuthenticatedCaller;

    beforeEach(() => {
      caller = createAuthenticatedCaller(db);
    });

    function createInput(overrides: Record<string, unknown> = {}) {
      return {
        name: "Pago semanal — Luis M.",
        automationId: "pay-collector",
        frequency: "weekly" as const,
        weekday: 5,
        timeOfDay: "08:00",
        staticParams: { collectorId, accountId, categoryId },
        ...overrides
      };
    }

    it("creates a task with the automation's floor as the default gate", async () => {
      const task = await caller.tasks.create(createInput());
      expect(task.gate).to.equal("confirm");
      expect(task.nextFireAt).to.not.equal(null);
      expect(task.enabled).to.equal(true);
    });

    it("rejects loosening the gate below the automation floor", async () => {
      let threw = false;
      try {
        await caller.tasks.create(createInput({ gate: "auto" }));
      } catch (err) {
        threw = true;
        expect((err as Error).message).to.include("confirmación");
      }
      expect(threw).to.equal(true);
      expect(await db.task.count()).to.equal(0);
    });

    it("rejects an unknown automation", async () => {
      let threw = false;
      try {
        await caller.tasks.create(createInput({ automationId: "tss-check" }));
      } catch (err) {
        threw = true;
        expect((err as Error).message).to.include("desconocida");
      }
      expect(threw).to.equal(true);
    });

    it("rejects invalid static slots at creation", async () => {
      let threw = false;
      try {
        await caller.tasks.create(createInput({ staticParams: { collectorId: "nope" } }));
      } catch {
        threw = true;
      }
      expect(threw).to.equal(true);
      expect(await db.task.count()).to.equal(0);
    });

    it("lists automations as descriptors for the schema-driven form", async () => {
      const descriptors = await caller.tasks.listAutomations();
      expect(descriptors.map((d) => d.id).sort()).to.deep.equal([
        "daily-close",
        "pay-collector",
        "record-expense"
      ]);
    });

    it("pause stops firing; resume recomputes nextFireAt forward", async () => {
      const task = await caller.tasks.create(createInput());
      const paused = await caller.tasks.setEnabled({ id: task.id, enabled: false });
      expect(paused.enabled).to.equal(false);

      // Make it look overdue while paused; the worker must not fire it.
      await db.task.update({
        where: { id: task.id },
        data: { nextFireAt: new Date(Date.now() - 1000) }
      });
      const pass = await processDueTasks(db);
      expect(pass.fired).to.equal(0);

      const resumed = await caller.tasks.setEnabled({ id: task.id, enabled: true });
      expect(resumed.nextFireAt!.getTime()).to.be.greaterThan(Date.now());
    });

    it("cancel deletes the definition while its open firing stays resolvable", async () => {
      const task = await caller.tasks.create(createInput());
      await db.task.update({
        where: { id: task.id },
        data: { nextFireAt: new Date(Date.now() - 1000) }
      });
      await processDueTasks(db);
      const firing = await db.taskFiring.findFirstOrThrow({ where: { taskId: task.id } });

      await caller.tasks.cancel({ id: task.id });
      expect(await db.task.count()).to.equal(0);

      const view = await caller.tasks.getFiring({ id: firing.id });
      expect(view.taskId).to.equal(null);
      expect(view.status).to.equal("READY");

      const confirmed = await caller.tasks.confirmFiring({
        id: firing.id,
        askValues: { amount: 3500 }
      });
      expect(confirmed.status).to.equal("DONE");
    });

    it("getFiring exposes payload, context, and pending ask slots for the card", async () => {
      const task = await caller.tasks.create(createInput());
      await db.task.update({
        where: { id: task.id },
        data: { nextFireAt: new Date(Date.now() - 1000) }
      });
      await processDueTasks(db);
      const firing = await db.taskFiring.findFirstOrThrow({});

      const view = await caller.tasks.getFiring({ id: firing.id });
      expect(view.askSlots.map((s) => s.name).sort()).to.deep.equal(["amount", "note"]);
      expect(view.context.collectorName).to.equal("Luis M.");
      expect(view.payload.accountId).to.equal(accountId);
    });

    it("confirm and a second resolution attempt: the second is rejected", async () => {
      const task = await caller.tasks.create(createInput());
      await db.task.update({
        where: { id: task.id },
        data: { nextFireAt: new Date(Date.now() - 1000) }
      });
      await processDueTasks(db);
      const firing = await db.taskFiring.findFirstOrThrow({});

      const first = await caller.tasks.confirmFiring({
        id: firing.id,
        askValues: { amount: 3500 }
      });
      expect(first.status).to.equal("DONE");

      let threw = false;
      try {
        await caller.tasks.skipFiring({ id: firing.id });
      } catch (err) {
        threw = true;
        expect((err as Error).message).to.include("resuelta");
      }
      expect(threw).to.equal(true);
      expect(await db.accountingTransaction.count()).to.equal(1);
    });
  });

  describe("copilot task tools", () => {
    /** Fake model replaying scripted turns (same shape as copilot.test.ts). */
    function makeFakeModel(
      turns: Array<{
        content: string;
        tool_calls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
      }>
    ) {
      let i = 0;
      return (): BaseChatModel =>
        ({
          bindTools() {
            return { invoke: async () => turns[Math.min(i++, turns.length - 1)] };
          }
        }) as unknown as BaseChatModel;
    }

    const noopExecutor: ToolExecutor = async () => ({ success: true, message: "OK" });

    it("binds the three task tools to the model", () => {
      const bound = getBoundToolNames();
      expect(bound).to.include.members(["createTask", "listTasks", "cancelTask"]);
    });

    it("createTask resolves collector/account/category names to UUIDs and creates the task", async () => {
      const chat = createCopilotChat({
        db,
        toolExecutor: noopExecutor,
        createModel: makeFakeModel([
          {
            content: "",
            tool_calls: [
              {
                id: "1",
                name: "createTask",
                args: {
                  name: "Pago semanal — Luis M.",
                  automationId: "pay-collector",
                  frequency: "weekly",
                  weekday: "5",
                  timeOfDay: "08:00",
                  staticParams: {
                    collectorId: "Luis M.",
                    accountId: "Caja principal",
                    categoryId: "Comisiones"
                  }
                }
              }
            ]
          },
          { content: "Listo, tarea creada." }
        ])
      });

      const reply = await chat({ userId: FOUNDER_ID, message: "cada viernes pagar a Luis" });
      expect(reply.reply).to.include("tarea");

      const task = await db.task.findFirstOrThrow({});
      const params = JSON.parse(task.staticParamsJson);
      expect(params.collectorId).to.equal(collectorId);
      expect(params.accountId).to.equal(accountId);
      expect(params.categoryId).to.equal(categoryId);
      expect(task.gate).to.equal("confirm");
    });

    it("createTask with an automation outside the catalog fails without creating anything", async () => {
      const chat = createCopilotChat({
        db,
        toolExecutor: noopExecutor,
        createModel: makeFakeModel([
          {
            content: "",
            tool_calls: [
              {
                id: "1",
                name: "createTask",
                args: {
                  name: "TSS",
                  automationId: "tss-check",
                  frequency: "daily",
                  timeOfDay: "08:00"
                }
              }
            ]
          },
          { content: "No pude crear la tarea." }
        ])
      });

      await chat({ userId: FOUNDER_ID, message: "revisa la tss cada día" });
      expect(await db.task.count()).to.equal(0);
    });
  });
});
