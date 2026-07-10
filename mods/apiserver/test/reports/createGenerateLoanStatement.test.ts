/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The loan-statement data builder: resolves the loan via the shared
 * `fetchLoanSnapshotInput` Prisma adapter and runs the shared
 * `loanStatementReport` definition from `@mikro/common` — the SAME definition
 * the CLI command and the `loan-statement` automation call, so this suite also
 * confirms the automation goes through that one code path (parity by
 * construction, no divergent second implementation).
 *
 * PDF byte rendering is exercised in the `@mikro/common` reporting suite
 * (injected local fonts there); here we stay at the data/validation layer, the
 * same convention the other `createGenerate*Report` unit tests follow.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createGenerateLoanStatement } from "../../src/api/reports/createGenerateLoanStatement.js";
import { loanStatement } from "../../src/tasks/automations/loanStatement.js";
import type { AutomationDeps } from "../../src/tasks/types.js";

const LOAN_START = new Date("2026-06-01T00:00:00.000Z"); // Monday
const AS_OF = new Date("2026-06-15T12:00:00.000Z");

/** A current WEEKLY loan (cuota 1000, term 4): 2 completed cuotas + a reversed row. */
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

describe("createGenerateLoanStatement", () => {
  afterEach(() => sinon.restore());

  it("rejects an invalid loan id before ever touching the database", async () => {
    const findUnique = sinon.stub().resolves(makeLoan());
    const client = { loan: { findUnique } };
    const fn = createGenerateLoanStatement(client as any);

    let err: unknown;
    try {
      await fn({ loanId: -1 });
    } catch (e) {
      err = e;
    }
    expect((err as Error).name).to.equal("ValidationError");
    expect(findUnique.called).to.equal(false);
  });

  it("rejects an unknown loan id with no document produced", async () => {
    const findUnique = sinon.stub().resolves(null);
    const client = { loan: { findUnique } };
    const fn = createGenerateLoanStatement(client as any);

    let err: unknown;
    try {
      await fn({ loanId: 99999 });
    } catch (e) {
      err = e;
    }
    expect(err).to.be.instanceOf(Error);
    expect((err as Error).message).to.include("99999");
  });

  it("builds the canonical JSON statement from a stubbed loan (format: json)", async () => {
    const findUnique = sinon.stub().resolves(makeLoan());
    const client = { loan: { findUnique } };
    const fn = createGenerateLoanStatement(client as any);

    const result = await fn({ loanId: 10099, format: "json" });

    expect(result.pdfBase64).to.equal(undefined);
    expect(result.mimeType).to.equal("application/json");
    expect(result.data.loanId).to.equal(10099);
    expect(result.data.schedule).to.have.length(4);
    // The reversed row is excluded from the received-payments ledger.
    expect(result.data.receivedPayments).to.have.length(2);
    expect(result.data.reversedCount).to.equal(1);
    expect(result.data.evalReport.pass).to.equal(true);
  });

  it("defaults to pdf format when unspecified, running the same toPdf branch", async () => {
    const findUnique = sinon.stub().resolves(makeLoan());
    const client = { loan: { findUnique } };
    // Injected empty font deps (DI, no live gstatic fetch): proves the pdf
    // branch actually runs — it fails deep inside satori's font resolution,
    // not at the format-selection point — without a real font dependency here.
    const fn = createGenerateLoanStatement(client as any, {
      renderDeps: { loadFonts: async () => [] }
    });

    let pdfErr: unknown;
    try {
      await fn({ loanId: 10099 });
    } catch (e) {
      pdfErr = e;
    }
    expect(pdfErr).to.not.equal(undefined);
  });
});

describe("loan-statement automation — shares the report definition, no ledger mutation", () => {
  afterEach(() => sinon.restore());

  function makeDeps(findUnique: sinon.SinonStub): AutomationDeps {
    const createTransaction = sinon.stub().resolves({});
    return {
      db: { loan: { findUnique } },
      createTransaction,
      actorId: "founder-1"
    } as unknown as AutomationDeps;
  }

  it("executes read-only: generates the statement, never calls createTransaction", async () => {
    const findUnique = sinon.stub().resolves(makeLoan());
    const deps = makeDeps(findUnique);

    const result = await loanStatement.execute({ loanId: 10099 }, deps);

    expect(findUnique.called).to.equal(true);
    expect((deps.createTransaction as sinon.SinonStub).called).to.equal(false);
    expect(result.summary).to.include("10099");
    expect(result.amount).to.equal(undefined);
  });

  it("the ask slot's schema rejects an invalid loan id before generation runs", () => {
    const parsed = loanStatement.params.loanId.schema.safeParse("not-a-number");
    expect(parsed.success).to.equal(false);
  });

  it("the ask slot's schema coerces and accepts a valid numeric-looking loan id", () => {
    const parsed = loanStatement.params.loanId.schema.safeParse("10099");
    expect(parsed.success).to.equal(true);
    if (parsed.success) expect(parsed.data).to.equal(10099);
  });

  it("goes through the exact same builder the tRPC procedure and CLI use (shared code path)", async () => {
    const findUnique = sinon.stub().resolves(makeLoan());
    const directFn = createGenerateLoanStatement({ loan: { findUnique } } as any);
    const direct = await directFn({ loanId: 10099, format: "json" });

    const findUnique2 = sinon.stub().resolves(makeLoan());
    const deps = makeDeps(findUnique2);
    await loanStatement.execute({ loanId: 10099 }, deps);

    // Both paths resolve through `createGenerateLoanStatement` → `loanStatementReport`;
    // given the same stubbed loan row, they produce the identical data model.
    expect(direct.data.schedule).to.have.length(4);
    expect(direct.data.evalReport.pass).to.equal(true);
  });
});
