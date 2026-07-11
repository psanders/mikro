/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The customers report: JSON is the canonical data model (rows grouped by
 * payment health, sorted worst-first), the PDF composes the KPI row and the
 * status-pill customers table from that same model, and invalid input
 * produces a structured error with no document.
 */
import { expect } from "chai";
import { readFileSync } from "fs";
import { createRequire } from "module";
import {
  customersReport,
  buildCustomersReportData,
  buildCustomersReportDocument,
  ValidationError,
  type Font,
  type ReportElement,
  type CustomersReportInput,
  type CustomersReportData
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
    { name: "Inter", data: read("500Medium/Geist_500Medium.ttf"), weight: 500, style: "normal" },
    {
      name: "Inter",
      data: read("600SemiBold/Geist_600SemiBold.ttf"),
      weight: 600,
      style: "normal"
    },
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

function documentText(data: CustomersReportData): string[] {
  const doc = buildCustomersReportDocument(data);
  return doc.pages.flatMap((p) => collectText(p.layout));
}

const ASOF = new Date("2026-03-01T00:00:00.000Z");

function baseInput(overrides: Partial<CustomersReportInput> = {}): CustomersReportInput {
  return {
    asOf: ASOF,
    generatedAt: ASOF,
    customers: [
      {
        name: "Cliente Crítico",
        phone: "809-000-0001",
        loans: [
          {
            loanId: 1,
            paymentFrequency: "WEEKLY",
            createdAt: new Date("2026-01-01T00:00:00Z"),
            startingDate: new Date("2026-01-01T00:00:00Z"),
            termLength: 10,
            paymentAmount: 1000,
            payments: [] // no payments at all -> worst rating
          }
        ]
      },
      {
        name: "Cliente Al Día",
        phone: "809-000-0002",
        loans: [
          {
            loanId: 2,
            paymentFrequency: "WEEKLY",
            createdAt: new Date("2026-01-01T00:00:00Z"),
            startingDate: new Date("2026-01-01T00:00:00Z"),
            termLength: 10,
            paymentAmount: 1000,
            payments: [
              { paidAt: new Date("2026-01-08T00:00:00Z"), status: "COMPLETED", amount: 1000 },
              { paidAt: new Date("2026-01-15T00:00:00Z"), status: "COMPLETED", amount: 1000 },
              { paidAt: new Date("2026-01-22T00:00:00Z"), status: "COMPLETED", amount: 1000 },
              { paidAt: new Date("2026-01-29T00:00:00Z"), status: "COMPLETED", amount: 1000 },
              { paidAt: new Date("2026-02-05T00:00:00Z"), status: "COMPLETED", amount: 1000 },
              { paidAt: new Date("2026-02-12T00:00:00Z"), status: "COMPLETED", amount: 1000 },
              { paidAt: new Date("2026-02-19T00:00:00Z"), status: "COMPLETED", amount: 1000 },
              { paidAt: new Date("2026-02-26T00:00:00Z"), status: "COMPLETED", amount: 1000 }
            ]
          }
        ]
      }
    ],
    ...overrides
  };
}

describe("customers report — validation", () => {
  it("rejects invalid/missing input with a structured ValidationError and produces no document", async () => {
    const bad = { customers: [{ name: "x" }] }; // missing phone/loans on the customer

    let jsonErr: unknown;
    try {
      await customersReport.toJson(bad);
    } catch (e) {
      jsonErr = e;
    }
    expect(jsonErr).to.be.instanceOf(ValidationError);
    expect((jsonErr as ValidationError).code).to.equal("VALIDATION_ERROR");

    let pdfResult: Buffer | undefined;
    let pdfErr: unknown;
    try {
      pdfResult = await customersReport.toPdf(bad, testDeps);
    } catch (e) {
      pdfErr = e;
    }
    expect(pdfErr).to.be.instanceOf(ValidationError);
    expect(pdfResult).to.equal(undefined);
  });
});

describe("customers report — JSON/PDF parity", () => {
  it("toJson groups rows by payment health, worst first", async () => {
    const json = await customersReport.toJson(baseInput());
    expect(json.activeCustomers).to.equal(2);
    expect(json.totalLoans).to.equal(2);
    expect(json.criticoCount).to.equal(1);
    expect(json.alDiaCount).to.equal(1);
    expect(json.rows).to.have.length(2);
    expect(json.rows[0].health).to.equal("critico");
    expect(json.rows[0].name).to.equal("Cliente Crítico");
    expect(json.rows[1].health).to.equal("alDia");
  });

  it("toPdf renders a 1-page PDF composing the KPI row and the status-pill table", async () => {
    const input = baseInput();
    const pdf = await customersReport.toPdf(input, testDeps);
    expect(pdf.subarray(0, 5).toString("latin1")).to.equal("%PDF-");
    const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page(?![s])/g) ?? []).length;
    expect(pageCount).to.equal(1);

    const data = buildCustomersReportData(input);
    const text = documentText(data).join(" ");
    expect(text).to.include("CLIENTES ACTIVOS");
    expect(text).to.include("Cliente Crítico");
    expect(text).to.include("Cliente Al Día");
    expect(text).to.include("Crítico");
    expect(text).to.include("Al día");
  });
});

describe("customers report — pagination (issue #201)", () => {
  function manyCustomers(count: number): CustomersReportInput {
    return {
      asOf: ASOF,
      generatedAt: ASOF,
      customers: Array.from({ length: count }, (_, i) => ({
        name: `Cliente Numero ${i}`,
        phone: "809-000-0000",
        loans: [
          {
            loanId: i + 1,
            paymentFrequency: "WEEKLY",
            createdAt: new Date("2026-01-01T00:00:00Z"),
            startingDate: new Date("2026-01-01T00:00:00Z"),
            termLength: 10,
            paymentAmount: 1000,
            payments: []
          }
        ]
      }))
    };
  }

  it("spills onto more than one PDF page instead of silently dropping customers past the fold", async () => {
    const input = manyCustomers(60);
    const pdf = await customersReport.toPdf(input, testDeps);
    const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page(?![s])/g) ?? []).length;
    expect(pageCount).to.be.greaterThan(1);

    const data = buildCustomersReportData(input);
    const text = documentText(data).join(" ");
    // The last customer used to render past the visible page boundary and
    // never appear in the rasterized PDF at all — now it's on a later page.
    expect(text).to.include("Cliente Numero 59");
  });

  it("renders a single page unchanged when the table comfortably fits", async () => {
    const input = manyCustomers(5);
    const pdf = await customersReport.toPdf(input, testDeps);
    const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page(?![s])/g) ?? []).length;
    expect(pageCount).to.equal(1);
  });
});
