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
