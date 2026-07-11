/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The renewal-candidates report: JSON is the canonical data model (KPIs +
 * candidate rows with a derived 3-way Activo/Completado/Por terminar status),
 * the PDF composes the KPI grid and the candidates table from that same
 * model, and invalid input produces a structured error with no document.
 */
import { expect } from "chai";
import { readFileSync } from "fs";
import { createRequire } from "module";
import {
  renewalReport,
  buildRenewalReportData,
  buildRenewalReportDocument,
  ValidationError,
  type Font,
  type ReportElement,
  type RenewalReportInput,
  type RenewalReportData
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

function documentText(data: RenewalReportData): string[] {
  const doc = buildRenewalReportDocument(data);
  return doc.pages.flatMap((p) => collectText(p.layout));
}

function baseInput(overrides: Partial<RenewalReportInput> = {}): RenewalReportInput {
  return {
    generatedAt: new Date("2026-03-01T00:00:00Z"),
    rows: [
      {
        name: "Ana Gómez",
        phone: "809-333-3333",
        loanId: 201,
        paymentFrequency: "WEEKLY",
        paymentsMade: 10,
        termLength: 10,
        paymentRating: 5,
        candidateNote: "Excelente historial, buena candidata para un préstamo mayor.",
        isCompleted: true,
        suggestedAmountDop: 10000
      },
      {
        name: "Luis Cabrera",
        phone: "809-444-4444",
        loanId: 202,
        paymentFrequency: "WEEKLY",
        paymentsMade: 9,
        termLength: 10,
        paymentRating: 4,
        candidateNote: null,
        isCompleted: false
        // suggestedAmountDop omitted on purpose
      },
      {
        name: "Rosa Núñez",
        phone: "809-555-5555",
        loanId: 203,
        paymentFrequency: "WEEKLY",
        paymentsMade: 5,
        termLength: 10,
        paymentRating: 4,
        candidateNote: "Al día pero a mitad de plazo.",
        isCompleted: false
      }
    ],
    ...overrides
  };
}

describe("renewal report — validation", () => {
  it("rejects invalid/missing input with a structured ValidationError and produces no document", async () => {
    const bad = { rows: [{ name: "x" }] }; // missing required row fields

    let jsonErr: unknown;
    try {
      await renewalReport.toJson(bad);
    } catch (e) {
      jsonErr = e;
    }
    expect(jsonErr).to.be.instanceOf(ValidationError);
    expect((jsonErr as ValidationError).code).to.equal("VALIDATION_ERROR");

    let pdfResult: Buffer | undefined;
    let pdfErr: unknown;
    try {
      pdfResult = await renewalReport.toPdf(bad, testDeps);
    } catch (e) {
      pdfErr = e;
    }
    expect(pdfErr).to.be.instanceOf(ValidationError);
    expect(pdfResult).to.equal(undefined);
  });
});

describe("renewal report — JSON/PDF parity", () => {
  it("toJson derives a 3-way status, an empty-note fallback, and averages only the supplied suggested amounts", async () => {
    const json = await renewalReport.toJson(baseInput());
    expect(json.candidateCount).to.equal(3);
    expect(json.pendingCount).to.equal(2);
    expect(json.rows[0].status).to.equal("completado");
    // 9/10 paid, 1 remaining cuota -> near completion.
    expect(json.rows[1].status).to.equal("porTerminar");
    expect(json.rows[1].candidateNote).to.equal("—");
    // 5/10 paid, 5 remaining -> not near completion.
    expect(json.rows[2].status).to.equal("activo");
    expect(json.averageRating).to.be.closeTo((5 + 4 + 4) / 3, 0.001);
    // Only row[0] supplied a suggested amount -> average is just that value.
    expect(json.suggestedAmountDop).to.equal(10000);
  });

  it("toPdf renders a 1-page PDF composing the KPI grid and the Activo/Completado/Por terminar table", async () => {
    const input = baseInput();
    const pdf = await renewalReport.toPdf(input, testDeps);
    expect(pdf.subarray(0, 5).toString("latin1")).to.equal("%PDF-");
    const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page(?![s])/g) ?? []).length;
    expect(pageCount).to.equal(1);

    const data = buildRenewalReportData(input);
    const text = documentText(data).join(" ");
    expect(text).to.include("CANDIDATOS");
    expect(text).to.include("Completado");
    expect(text).to.include("Por terminar");
    expect(text).to.include("Activo");
    expect(text).to.include("Ana Gómez");
  });

  it("with no rows supplying a suggested amount, the KPI shows a placeholder", async () => {
    const input = baseInput({
      rows: baseInput().rows.map((r) => ({ ...r, suggestedAmountDop: undefined }))
    });
    const json = await renewalReport.toJson(input);
    expect(json.suggestedAmountDop).to.equal(null);
    const text = documentText(json).join(" ");
    expect(text).to.include("—");
  });
});
