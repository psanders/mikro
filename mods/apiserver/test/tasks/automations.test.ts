/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Seed automation behavior with stubbed deps: pay-collector and
 * record-expense post one expense; daily-close bridges per method, refuses a
 * double close, and completes a zero day without posting.
 */
import { expect } from "chai";
import sinon from "sinon";
import { payCollector } from "../../src/tasks/automations/payCollector.js";
import { recordExpense } from "../../src/tasks/automations/recordExpense.js";
import { dailyClose } from "../../src/tasks/automations/dailyClose.js";
import type { AutomationDeps } from "../../src/tasks/types.js";

const ACTOR = "9d4bb054-8b4c-4c53-9241-7b3a37dbfb2e";

function makeDeps(overrides: Record<string, unknown> = {}): {
  deps: AutomationDeps;
  createTransaction: sinon.SinonStub;
} {
  const createTransaction = sinon.stub().resolves({});
  const db = {
    user: { findUnique: sinon.stub().resolves({ name: "Luis M." }) },
    payment: { findMany: sinon.stub().resolves([]) },
    accountingTransaction: { findFirst: sinon.stub().resolves(null) },
    ...overrides
  };
  return {
    deps: { db, createTransaction, actorId: ACTOR } as unknown as AutomationDeps,
    createTransaction
  };
}

describe("pay-collector", () => {
  afterEach(() => sinon.restore());

  it("posts one expense with the confirmed amount", async () => {
    const { deps, createTransaction } = makeDeps();
    const result = await payCollector.execute(
      {
        collectorId: "0d4bb054-8b4c-4c53-9241-7b3a37dbfb2e",
        accountId: "1d4bb054-8b4c-4c53-9241-7b3a37dbfb2e",
        categoryId: "2d4bb054-8b4c-4c53-9241-7b3a37dbfb2e",
        amount: 3500
      },
      deps
    );

    expect(createTransaction.calledOnce).to.be.true;
    const args = createTransaction.firstCall.args[0];
    expect(args.type).to.equal("EXPENSE");
    expect(args.amount).to.equal(3500);
    expect(args.createdById).to.equal(ACTOR);
    expect(result.amount).to.equal(3500);
    expect(result.summary).to.include("Luis M.");
  });

  it("uses the founder's note as the description when given", async () => {
    const { deps, createTransaction } = makeDeps();
    await payCollector.execute(
      {
        collectorId: "0d4bb054-8b4c-4c53-9241-7b3a37dbfb2e",
        accountId: "1d4bb054-8b4c-4c53-9241-7b3a37dbfb2e",
        categoryId: "2d4bb054-8b4c-4c53-9241-7b3a37dbfb2e",
        amount: 3500,
        note: "Pago semana 27"
      },
      deps
    );
    expect(createTransaction.firstCall.args[0].description).to.equal("Pago semana 27");
  });

  it("buildContext sums the collector's trailing-week collections", async () => {
    const findMany = sinon.stub().resolves([{ amount: 1000 }, { amount: 2500 }]);
    const { deps } = makeDeps({ payment: { findMany } });
    const ctx = await payCollector.buildContext!({
      db: deps.db,
      staticParams: { collectorId: "0d4bb054-8b4c-4c53-9241-7b3a37dbfb2e" },
      dueAt: new Date("2026-07-10T12:00:00Z"),
      now: new Date("2026-07-10T12:00:00Z")
    });
    expect(ctx.weekCollected).to.equal(3500);
    expect(ctx.weekPayments).to.equal(2);
    expect(ctx.collectorName).to.equal("Luis M.");
    expect(findMany.firstCall.args[0].where.status).to.deep.equal({ not: "REVERSED" });
  });
});

describe("record-expense", () => {
  afterEach(() => sinon.restore());

  it("posts one expense described by the concept", async () => {
    const { deps, createTransaction } = makeDeps();
    const result = await recordExpense.execute(
      {
        concept: "Gasolina de la semana",
        accountId: "1d4bb054-8b4c-4c53-9241-7b3a37dbfb2e",
        categoryId: "2d4bb054-8b4c-4c53-9241-7b3a37dbfb2e",
        amount: 2000
      },
      deps
    );
    expect(createTransaction.calledOnce).to.be.true;
    expect(createTransaction.firstCall.args[0].description).to.equal("Gasolina de la semana");
    expect(result.summary).to.include("Gasolina");
  });
});

describe("daily-close", () => {
  afterEach(() => sinon.restore());

  const payload = {
    accountId: "1d4bb054-8b4c-4c53-9241-7b3a37dbfb2e",
    closeDate: "2026-07-05"
  };

  it("posts one INCOME deposit per payment method", async () => {
    const findMany = sinon.stub().resolves([
      { amount: 1000, method: "CASH" },
      { amount: 500, method: "CASH" },
      { amount: 2000, method: "TRANSFER" }
    ]);
    const { deps, createTransaction } = makeDeps({ payment: { findMany } });

    const result = await dailyClose.execute(payload, deps);

    expect(createTransaction.callCount).to.equal(2);
    const refs = createTransaction.getCalls().map((c) => c.args[0].reference);
    expect(refs).to.include.members([
      "daily-close:2026-07-05:CASH",
      "daily-close:2026-07-05:TRANSFER"
    ]);
    for (const call of createTransaction.getCalls()) {
      expect(call.args[0].type).to.equal("INCOME");
    }
    expect(result.amount).to.equal(3500);
  });

  it("refuses to close an already-bridged date and posts nothing", async () => {
    const { deps, createTransaction } = makeDeps({
      accountingTransaction: { findFirst: sinon.stub().resolves({ id: "txn-1" }) }
    });

    let error: Error | null = null;
    try {
      await dailyClose.execute(payload, deps);
    } catch (err) {
      error = err as Error;
    }

    expect(error).to.not.equal(null);
    expect(error!.message).to.include("ya fue cerrado");
    expect(createTransaction.called).to.be.false;
  });

  it("completes a zero-collection day without posting", async () => {
    const { deps, createTransaction } = makeDeps();
    const result = await dailyClose.execute(payload, deps);
    expect(createTransaction.called).to.be.false;
    expect(result.summary).to.include("sin cobranza");
  });

  it("resolves closeDate to the firing's own Santo Domingo day", async () => {
    const { deps } = makeDeps();
    // 2026-07-06 03:30 UTC = 2026-07-05 23:30 in Santo Domingo; same-day close = 07-05.
    const value = await dailyClose.params.closeDate.resolve!({
      db: deps.db,
      staticParams: {},
      dueAt: new Date("2026-07-06T03:30:00Z"),
      now: new Date("2026-07-06T03:30:00Z")
    });
    expect(value).to.equal("2026-07-05");
  });
});
