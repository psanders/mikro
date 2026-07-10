/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The accounting-snapshot report: JSON is the canonical data model (account
 * balances + transaction ledger + totals), the PDF composes the KPI grid and
 * the two tables (balances, movimientos with a type pill) from that same
 * model, and invalid input produces a structured error with no document.
 */
import { expect } from "chai";
import { readFileSync } from "fs";
import { createRequire } from "module";
import {
  accountingReport,
  buildAccountingReportData,
  buildAccountingReportDocument,
  ValidationError,
  type Font,
  type ReportElement,
  type AccountingReportInput,
  type AccountingReportSnapshot
} from "@mikro/common";

function loadLocalFonts(): Font[] {
  const req = createRequire(import.meta.url);
  const base = req.resolve("@expo-google-fonts/geist/package.json").replace(/package\.json$/, "");
  const read = (rel: string): ArrayBuffer => {
    const buf = readFileSync(base + rel);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  };
  return [
    { name: "Inter", data: read("400Regular/Geist_400Regular.ttf"), weight: 400, style: "normal" },
    { name: "Inter", data: read("700Bold/Geist_700Bold.ttf"), weight: 700, style: "normal" },
    { name: "Inter", data: read("900Black/Geist_900Black.ttf"), weight: 900, style: "normal" }
  ];
}

const injectedFonts = loadLocalFonts();
const testDeps = { loadFonts: async () => injectedFonts };

function collectText(
  node: ReportElement | ReportElement[] | unknown,
  out: string[] = []
): string[] {
  if (Array.isArray(node)) {
    node.forEach((n) => collectText(n, out));
    return out;
  }
  if (node && typeof node === "object" && "props" in (node as ReportElement)) {
    const el = node as ReportElement;
    const children = el.props.children;
    if (typeof children === "string") out.push(children);
    else if (children) collectText(children, out);
  }
  return out;
}

function documentText(data: AccountingReportSnapshot): string[] {
  const doc = buildAccountingReportDocument(data);
  return doc.pages.flatMap((p) => collectText(p.layout));
}

function baseInput(overrides: Partial<AccountingReportInput> = {}): AccountingReportInput {
  return {
    period: { startDate: "2026-06-01", endDate: "2026-06-30" },
    generatedAt: new Date("2026-07-01T00:00:00Z"),
    accounts: [
      { name: "Caja principal", kind: "CASH", currency: "DOP", currentBalance: 20000 },
      { name: "Banco Popular", kind: "BANK", currency: "DOP", currentBalance: 80000 }
    ],
    transactions: [
      {
        occurredAt: new Date("2026-06-05T00:00:00Z"),
        type: "INCOME",
        accountName: "Caja principal",
        categoryName: "Cobros",
        vendor: null,
        description: "Cobro de cuotas",
        amount: 5000
      },
      {
        occurredAt: new Date("2026-06-10T00:00:00Z"),
        type: "EXPENSE",
        accountName: "Banco Popular",
        categoryName: "Nómina",
        vendor: "Planilla",
        description: null,
        amount: 3000
      },
      {
        occurredAt: new Date("2026-06-12T00:00:00Z"),
        type: "DEPOSIT",
        accountName: "Banco Popular",
        categoryName: null,
        vendor: null,
        description: null,
        amount: 2000
      }
    ],
    totals: { totalIncome: 5000, totalExpenses: 3000, netFlow: 2000, combinedBalance: 100000 },
    ...overrides
  };
}

describe("accounting report — validation", () => {
  it("rejects invalid/missing input with a structured ValidationError and produces no document", async () => {
    const bad = { accounts: [{ name: "x" }] }; // missing period/transactions/totals

    let jsonErr: unknown;
    try {
      await accountingReport.toJson(bad);
    } catch (e) {
      jsonErr = e;
    }
    expect(jsonErr).to.be.instanceOf(ValidationError);
    expect((jsonErr as ValidationError).code).to.equal("VALIDATION_ERROR");

    let pdfResult: Buffer | undefined;
    let pdfErr: unknown;
    try {
      pdfResult = await accountingReport.toPdf(bad, testDeps);
    } catch (e) {
      pdfErr = e;
    }
    expect(pdfErr).to.be.instanceOf(ValidationError);
    expect(pdfResult).to.equal(undefined);
  });
});

describe("accounting report — JSON/PDF parity", () => {
  it("toJson returns the canonical accounts + transactions + totals model", async () => {
    const json = await accountingReport.toJson(baseInput());
    expect(json.accounts).to.have.length(2);
    expect(json.transactions).to.have.length(3);
    expect(json.totals.combinedBalance).to.equal(100000);
    expect(json.transactions[0].occurredAt).to.equal(
      new Date("2026-06-05T00:00:00Z").toISOString()
    );
  });

  it("toPdf renders a 1-page PDF composing the KPI grid, the balances table, and the movimientos type-pill table", async () => {
    const input = baseInput();
    const pdf = await accountingReport.toPdf(input, testDeps);
    expect(pdf.subarray(0, 5).toString("latin1")).to.equal("%PDF-");
    const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page(?![s])/g) ?? []).length;
    expect(pageCount).to.equal(1);

    const data = buildAccountingReportData(input);
    const text = documentText(data).join(" ");
    expect(text).to.include("INGRESOS");
    expect(text).to.include("BALANCE DE CUENTAS");
    expect(text).to.include("MOVIMIENTOS");
    expect(text).to.include("Caja principal");
    expect(text).to.include("Ingreso");
    expect(text).to.include("Gasto");
    expect(text).to.include("Depósito");
  });
});
