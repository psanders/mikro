/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Snapshot + single-loan health endpoints: the raw ledger carries every status
 * (incl. REVERSED), the derived numbers exclude reversed money, and the LLM
 * narration flows through when a model factory is wired.
 */
import { expect } from "chai";
import sinon from "sinon";
import { CHECK_COUNT } from "@mikro/common";
import { buildLoanSnapshotFromDb } from "../../src/api/loans/buildLoanSnapshotFromDb.js";
import { createGetLoanHealth } from "../../src/api/loans/createGetLoanHealth.js";

const LOAN_START = new Date("2026-06-01T00:00:00.000Z"); // Monday
const AS_OF = new Date("2026-06-15T12:00:00.000Z"); // +14 days → 2 weekly cycles

/** A current WEEKLY loan (cuota 1000, term 4): 2 completed cuotas + a bogus REVERSED row. */
function makeLoan(loanId = 10099) {
  return {
    loanId,
    principal: 4000,
    paymentAmount: 1000,
    termLength: 4,
    paymentFrequency: "WEEKLY",
    status: "ACTIVE",
    moraRate: null,
    createdAt: LOAN_START,
    startingDate: LOAN_START,
    updatedAt: AS_OF,
    nickname: null,
    customer: {
      id: "cust-1",
      name: "Cliente Prueba",
      nickname: null,
      preferredPaymentDay: null
    },
    payments: [
      {
        id: "p1",
        kind: "INSTALLMENT",
        status: "COMPLETED",
        amount: 1000,
        paidAt: new Date("2026-06-02T10:00:00Z"),
        method: "CASH",
        collectedById: "u1",
        linkedPaymentId: null,
        notes: null,
        collectedBy: { name: "Cobrador Uno" }
      },
      {
        id: "p2",
        kind: "INSTALLMENT",
        status: "COMPLETED",
        amount: 1000,
        paidAt: new Date("2026-06-09T10:00:00Z"),
        method: "CASH",
        collectedById: "u1",
        linkedPaymentId: null,
        notes: null,
        collectedBy: { name: "Cobrador Uno" }
      },
      {
        id: "p3-reversed",
        kind: "INSTALLMENT",
        status: "REVERSED",
        amount: 5000,
        paidAt: new Date("2026-06-05T10:00:00Z"),
        method: "CASH",
        collectedById: "u1",
        linkedPaymentId: null,
        notes: "anulado",
        collectedBy: { name: "Cobrador Uno" }
      }
    ]
  };
}

describe("buildLoanSnapshotFromDb", () => {
  afterEach(() => sinon.restore());

  it("keeps the full raw ledger but excludes reversed money from derived", async () => {
    const client = { loan: { findUnique: sinon.stub().resolves(makeLoan()) } };
    const snapshot = await buildLoanSnapshotFromDb(client as any, 10099, AS_OF);

    expect(snapshot).to.not.equal(null);
    expect(snapshot!.ledger).to.have.length(3); // reversed row is present in raw ledger
    const reversed = snapshot!.ledger.find((l) => l.id === "p3-reversed")!;
    expect(reversed.countsTowardCuotas).to.equal(false);

    // 2×1000 counted, the 5000 reversed row ignored.
    expect(snapshot!.derived.totalInstallmentPaid).to.equal(2000);
    expect(snapshot!.derived.cuotasCovered).to.equal(2);
    expect(snapshot!.derived.pendingPayments).to.equal(2);
    expect(snapshot!.derived.remainingBalance).to.equal(2000);
    expect(snapshot!.derived.moraAccrued).to.equal(0);
  });

  it("returns null for a missing loan", async () => {
    const client = { loan: { findUnique: sinon.stub().resolves(null) } };
    const snapshot = await buildLoanSnapshotFromDb(client as any, 404, AS_OF);
    expect(snapshot).to.equal(null);
  });

  it("requests the payments include with the collector name (unfiltered by status)", async () => {
    const findUnique = sinon.stub().resolves(makeLoan());
    await buildLoanSnapshotFromDb({ loan: { findUnique } } as any, 10099, AS_OF);
    const arg = findUnique.firstCall.args[0];
    expect(arg.where).to.deep.equal({ loanId: 10099 });
    expect(arg.include.payments.include.collectedBy).to.deep.equal({ select: { name: true } });
    expect(arg.include.payments.where).to.equal(undefined); // ALL statuses
  });
});

describe("createGetLoanHealth", () => {
  afterEach(() => sinon.restore());

  it("runs every check and returns no narration without a model", async () => {
    const client = { loan: { findUnique: sinon.stub().resolves(makeLoan()) } };
    const health = createGetLoanHealth(client as any);
    const { report, narration } = await health({ loanId: 10099, explain: true });
    expect(report.results).to.have.length(CHECK_COUNT);
    expect(narration).to.equal(null); // no createModel wired
  });

  it("adds an LLM narration when explain is set and a model is wired", async () => {
    const client = { loan: { findUnique: sinon.stub().resolves(makeLoan()) } };
    const invoke = sinon.stub().resolves({ content: "  Explicación de prueba  " });
    const createModel = sinon.stub().returns({ invoke });
    const health = createGetLoanHealth(client as any, { createModel: createModel as any });

    const { narration } = await health({ loanId: 10099, explain: true });
    expect(createModel.calledOnce).to.equal(true);
    expect(narration).to.equal("Explicación de prueba");
  });

  it("skips narration when explain is false even with a model wired", async () => {
    const client = { loan: { findUnique: sinon.stub().resolves(makeLoan()) } };
    const createModel = sinon.stub();
    const health = createGetLoanHealth(client as any, { createModel: createModel as any });
    const { narration } = await health({ loanId: 10099, explain: false });
    expect(createModel.called).to.equal(false);
    expect(narration).to.equal(null);
  });
});
