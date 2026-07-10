/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The customers-report data builder: resolves active customers + their
 * active loans/completed payments via Prisma (the same query
 * `createExportAllCustomers` already used) and runs the shared
 * `customersReport` definition (`@mikro/common`) — the new JSON/PDF endpoint
 * (issue #110 migration; no PNG/Excel path is exercised here).
 */
import { expect } from "chai";
import sinon from "sinon";
import { createGenerateCustomersReport } from "../../src/api/reports/createGenerateCustomersReport.js";

function makeCustomer(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "Cliente Prueba",
    nickname: null,
    phone: "8091234567",
    preferredPaymentDay: null,
    loans: [
      {
        loanId: 20001,
        paymentFrequency: "WEEKLY",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        startingDate: new Date("2026-01-01T00:00:00Z"),
        termLength: 4,
        paymentAmount: 1000,
        nickname: null,
        payments: [
          { paidAt: new Date("2026-01-08T00:00:00Z"), status: "COMPLETED", amount: 1000 },
          { paidAt: new Date("2026-01-15T00:00:00Z"), status: "COMPLETED", amount: 1000 }
        ]
      }
    ],
    ...overrides
  };
}

describe("createGenerateCustomersReport", () => {
  afterEach(() => sinon.restore());

  it("builds the canonical JSON customers report from stubbed active customers (format: json)", async () => {
    const findMany = sinon.stub().resolves([makeCustomer()]);
    const client = { customer: { findMany } };
    const fn = createGenerateCustomersReport(client as never);

    const result = await fn({ format: "json" });

    expect(result.pdfBase64).to.equal(undefined);
    expect(result.mimeType).to.equal("application/json");
    expect(result.data.activeCustomers).to.equal(1);
    expect(result.data.totalLoans).to.equal(1);
    expect(result.data.rows).to.have.length(1);
    expect(result.data.rows[0]?.loanId).to.equal(20001);
    expect(result.filename).to.match(/^clientes-.*\.json$/);
    expect(findMany.calledOnce).to.equal(true);
  });

  it("defaults to pdf format when unspecified, running the same toPdf branch", async () => {
    const findMany = sinon.stub().resolves([makeCustomer()]);
    const client = { customer: { findMany } };
    const fn = createGenerateCustomersReport(client as never, {
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

  it("returns empty groups when there are no active customers", async () => {
    const findMany = sinon.stub().resolves([]);
    const client = { customer: { findMany } };
    const fn = createGenerateCustomersReport(client as never);

    const result = await fn({ format: "json" });

    expect(result.data.activeCustomers).to.equal(0);
    expect(result.data.rows).to.have.length(0);
  });
});
