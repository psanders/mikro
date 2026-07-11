/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The defaulted (at-risk) loans report: JSON is the canonical data model
 * (KPIs + at-risk rows, notes defaulting to "Sin notas"), the PDF composes the
 * KPI grid and the Atrasado/Default status-pill table from that same model,
 * and invalid input produces a structured error with no document.
 */
import { expect } from "chai";
import { readFileSync } from "fs";
import { createRequire } from "module";
import {
  defaultedReport,
  buildDefaultedReportData,
  buildDefaultedReportDocument,
  ValidationError,
  type Font,
  type ReportElement,
  type DefaultedReportInput,
  type DefaultedReportData
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

function documentText(data: DefaultedReportData): string[] {
  const doc = buildDefaultedReportDocument(data);
  return doc.pages.flatMap((p) => collectText(p.layout));
}

function baseInput(overrides: Partial<DefaultedReportInput> = {}): DefaultedReportInput {
  return {
    totalPrincipalAtRiskDop: 15000,
    generatedAt: new Date("2026-03-01T00:00:00Z"),
    rows: [
      {
        name: "Juana Pérez",
        nickname: null,
        phone: "809-111-1111",
        loanId: 101,
        paymentFrequency: "WEEKLY",
        totalPaid: 2000,
        moraCollected: 300,
        summary: "Cliente reporta problemas de ingresos temporales.",
        isDefaulted: true
      },
      {
        name: "Marco Reyes",
        nickname: "Marquito",
        phone: "809-222-2222",
        loanId: 102,
        paymentFrequency: "BIWEEKLY",
        totalPaid: 4000,
        moraCollected: 0,
        summary: null,
        isDefaulted: false
      }
    ],
    ...overrides
  };
}

describe("defaulted report — validation", () => {
  it("rejects invalid/missing input with a structured ValidationError and produces no document", async () => {
    const bad = { rows: [{ name: "x" }] }; // missing required row fields + totalPrincipalAtRiskDop

    let jsonErr: unknown;
    try {
      await defaultedReport.toJson(bad);
    } catch (e) {
      jsonErr = e;
    }
    expect(jsonErr).to.be.instanceOf(ValidationError);
    expect((jsonErr as ValidationError).code).to.equal("VALIDATION_ERROR");

    let pdfResult: Buffer | undefined;
    let pdfErr: unknown;
    try {
      pdfResult = await defaultedReport.toPdf(bad, testDeps);
    } catch (e) {
      pdfErr = e;
    }
    expect(pdfErr).to.be.instanceOf(ValidationError);
    expect(pdfResult).to.equal(undefined);
  });
});

describe("defaulted report — JSON/PDF parity", () => {
  it("toJson returns the canonical KPI + row model, defaulting an absent summary to 'Sin notas'", async () => {
    const json = await defaultedReport.toJson(baseInput());
    expect(json.totalAtRisk).to.equal(2);
    expect(json.totalPrincipalAtRiskDop).to.equal(15000);
    expect(json.moraCollectedTotalDop).to.equal(300);
    expect(json.defaultRatePct).to.equal(50);
    expect(json.rows[0].notes).to.equal("Cliente reporta problemas de ingresos temporales.");
    expect(json.rows[1].notes).to.equal("Sin notas");
  });

  it("toPdf renders a 1-page PDF composing the KPI grid and the Atrasado/Default status-pill table", async () => {
    const input = baseInput();
    const pdf = await defaultedReport.toPdf(input, testDeps);
    expect(pdf.subarray(0, 5).toString("latin1")).to.equal("%PDF-");
    const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page(?![s])/g) ?? []).length;
    expect(pageCount).to.equal(1);

    const data = buildDefaultedReportData(input);
    const text = documentText(data).join(" ");
    expect(text).to.include("PRÉSTAMOS EN RIESGO");
    expect(text).to.include("Default");
    expect(text).to.include("Atrasado");
    expect(text).to.include("Juana Pérez");
    expect(text).to.include("Sin notas");
  });
});

describe("defaulted report — pagination (issue #202)", function () {
  this.timeout(20000);

  function manyRows(count: number, longNotes: boolean): DefaultedReportInput {
    const longNote =
      "Cliente reporta problemas de ingresos temporales por la temporada baja en su negocio. ".repeat(
        10
      );
    return {
      totalPrincipalAtRiskDop: 500000,
      generatedAt: new Date("2026-03-01T00:00:00Z"),
      rows: Array.from({ length: count }, (_, i) => ({
        name: `Cliente Numero ${i}`,
        nickname: null,
        phone: "809-000-0000",
        loanId: 100 + i,
        paymentFrequency: "WEEKLY",
        totalPaid: 2000,
        moraCollected: 300,
        summary: longNotes ? longNote : "Nota corta",
        isDefaulted: i % 2 === 0
      }))
    };
  }

  // A row count/notes-length combination that used to crash the whole Node
  // process with a native resvg panic (unrecoverable, not a catchable JS
  // error) instead of throwing — see the module doc on `dataTable`'s
  // SINGLE_LINE_CLAMP and `paginateRows` for the two-part fix.
  it("renders a many-page PDF instead of crashing on a large, long-notes at-risk portfolio", async () => {
    const input = manyRows(80, true);
    const pdf = await defaultedReport.toPdf(input, testDeps);
    expect(pdf.subarray(0, 5).toString("latin1")).to.equal("%PDF-");
    const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page(?![s])/g) ?? []).length;
    expect(pageCount).to.be.greaterThan(1);

    const data = buildDefaultedReportData(input);
    const text = documentText(data).join(" ");
    expect(text).to.include("Cliente Numero 79");
  });

  it("renders a single page unchanged when the table comfortably fits", async () => {
    const input = manyRows(5, false);
    const pdf = await defaultedReport.toPdf(input, testDeps);
    const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page(?![s])/g) ?? []).length;
    expect(pageCount).to.equal(1);
  });
});
