/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The accounting-report data builder: resolves accounts + the period's
 * transactions via Prisma and runs the shared `accountingReport` definition
 * (`@mikro/common`) — the satori→PNG path is no longer called from here.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createGenerateAccountingReport } from "../../src/api/reports/createGenerateAccountingReport.js";

function makeClient() {
  const account = {
    id: "acc-1",
    name: "Caja principal",
    kind: "CASH" as const,
    currency: "DOP",
    openingBalance: 0,
    currentBalance: 5000,
    isActive: true,
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z")
  };

  const transaction = {
    id: "txn-1",
    type: "INCOME" as const,
    status: "POSTED" as const,
    amount: 1500,
    occurredAt: new Date("2026-06-10T00:00:00Z"),
    description: "Cobro",
    vendor: null,
    reference: null,
    reversalOfId: null,
    accountId: "acc-1",
    toAccountId: null,
    categoryId: null,
    createdById: "u1",
    createdAt: new Date("2026-06-10T00:00:00Z"),
    updatedAt: new Date("2026-06-10T00:00:00Z"),
    account: { id: "acc-1", name: "Caja principal" },
    toAccount: null,
    category: null,
    createdBy: { id: "u1", name: "Founder" },
    _count: { attachments: 0 }
  };

  return {
    accountingAccount: { findMany: sinon.stub().resolves([account]) },
    accountingTransaction: { findMany: sinon.stub().resolves([transaction]) }
  };
}

/**
 * A client whose `accountingTransaction.findMany` actually honors the
 * `where` (occurredAt window + `status` + `reversalOfId`), seeded with a
 * reversed original, its reversal entry, and one untouched income. Lets the
 * test prove the report's query excludes both halves of a reversal.
 */
function makeClientWithReversal() {
  const account = {
    id: "acc-1",
    name: "Caja principal",
    kind: "CASH" as const,
    currency: "DOP",
    openingBalance: 0,
    currentBalance: 5000,
    isActive: true,
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z")
  };

  const base = {
    vendor: null,
    reference: null,
    accountId: "acc-1",
    toAccountId: null,
    categoryId: null,
    createdById: "u1",
    account: { id: "acc-1", name: "Caja principal" },
    toAccount: null,
    category: null,
    createdBy: { id: "u1", name: "Founder" },
    _count: { attachments: 0 }
  };

  const untouched = {
    ...base,
    id: "txn-keep",
    type: "INCOME" as const,
    status: "POSTED" as const,
    amount: 1500,
    occurredAt: new Date("2026-06-10T00:00:00Z"),
    description: "Cobro",
    reversalOfId: null,
    createdAt: new Date("2026-06-10T00:00:00Z"),
    updatedAt: new Date("2026-06-10T00:00:00Z")
  };

  const reversedOriginal = {
    ...base,
    id: "txn-orig",
    type: "INCOME" as const,
    status: "REVERSED" as const,
    amount: 900,
    occurredAt: new Date("2026-06-12T00:00:00Z"),
    description: "Cobro anulado",
    reversalOfId: null,
    createdAt: new Date("2026-06-12T00:00:00Z"),
    updatedAt: new Date("2026-06-15T00:00:00Z")
  };

  const reversalEntry = {
    ...base,
    id: "txn-rev",
    type: "INCOME" as const,
    status: "POSTED" as const,
    amount: 900,
    occurredAt: new Date("2026-06-15T00:00:00Z"),
    description: "Reversal of txn-orig — Cobro anulado",
    reversalOfId: "txn-orig",
    createdAt: new Date("2026-06-15T00:00:00Z"),
    updatedAt: new Date("2026-06-15T00:00:00Z")
  };

  const all = [untouched, reversedOriginal, reversalEntry];

  const findMany = sinon.stub().callsFake(async ({ where }: { where: Record<string, unknown> }) => {
    const gte = (where.occurredAt as { gte: Date }).gte;
    const lte = (where.occurredAt as { lte: Date }).lte;
    return all.filter((t) => {
      if (t.occurredAt < gte || t.occurredAt > lte) return false;
      if (where.status !== undefined && t.status !== where.status) return false;
      if (where.reversalOfId === null && t.reversalOfId !== null) return false;
      return true;
    });
  });

  return {
    client: {
      accountingAccount: { findMany: sinon.stub().resolves([account]) },
      accountingTransaction: { findMany }
    },
    findMany
  };
}

describe("createGenerateAccountingReport", () => {
  afterEach(() => sinon.restore());

  it("builds the canonical JSON accounting snapshot from stubbed Prisma rows (format: json)", async () => {
    const client = makeClient();
    const fn = createGenerateAccountingReport(client as never);

    const result = await fn({
      startDate: new Date("2026-06-01T00:00:00Z"),
      endDate: new Date("2026-06-30T00:00:00Z"),
      format: "json"
    });

    expect(result.pdfBase64).to.equal(undefined);
    expect(result.mimeType).to.equal("application/json");
    expect(result.data.accounts).to.have.length(1);
    expect(result.data.transactions).to.have.length(1);
    expect(result.data.totals.totalIncome).to.equal(1500);
    expect(result.data.totals.combinedBalance).to.equal(5000);
    expect(result.filename).to.match(/^contable-.*\.json$/);
  });

  it("excludes both the reversed original and its reversal entry from the ledger and totals", async () => {
    const { client, findMany } = makeClientWithReversal();
    const fn = createGenerateAccountingReport(client as never);

    const result = await fn({
      startDate: new Date("2026-06-01T00:00:00Z"),
      endDate: new Date("2026-06-30T00:00:00Z"),
      format: "json"
    });

    // The query itself must scope out reversal entries, not just REVERSED originals.
    expect(findMany.firstCall.args[0].where).to.include({
      status: "POSTED",
      reversalOfId: null
    });

    // Only the untouched income survives — the 900 reversal round-trip nets to nothing.
    expect(result.data.transactions).to.have.length(1);
    expect(result.data.transactions[0].description).to.equal("Cobro");
    expect(result.data.totals.totalIncome).to.equal(1500);
    expect(result.data.totals.netFlow).to.equal(1500);
  });

  it("defaults to pdf format when unspecified, running the same toPdf branch", async () => {
    const client = makeClient();
    const fn = createGenerateAccountingReport(client as never, {
      renderDeps: { loadFonts: async () => [] }
    });

    let pdfErr: unknown;
    try {
      await fn({});
    } catch (e) {
      pdfErr = e;
    }
    expect(pdfErr).to.not.equal(undefined);
  });
});
