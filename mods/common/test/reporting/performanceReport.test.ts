/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The performance report: JSON is the canonical data model (KPIs + status/size
 * breakdowns + narrative), the PDF composes the KPI grid, the two breakdown
 * tables, and the narrative sections from that same model, and invalid input
 * produces a structured error with no document.
 */
import { expect } from "chai";
import { readFileSync } from "fs";
import { createRequire } from "module";
import {
  performanceReport,
  buildPerformanceReportData,
  buildPerformanceReportDocument,
  ValidationError,
  type Font,
  type ReportElement,
  type PerformanceReportInput,
  type PerformanceReportData
} from "@mikro/common";

/** Load local Geist TTFs and label them "Inter" so satori matches fontFamily. */
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

function documentText(data: PerformanceReportData): string[] {
  const doc = buildPerformanceReportDocument(data);
  return doc.pages.flatMap((p) => collectText(p.layout));
}

function baseInput(overrides: Partial<PerformanceReportInput> = {}): PerformanceReportInput {
  return {
    metrics: {
      period: { startDate: "2026-06-01", endDate: "2026-06-30" },
      loansByStatus: {
        ACTIVE: { count: 10, principalDop: 50000 },
        COMPLETED: { count: 5, principalDop: 25000 },
        DEFAULTED: { count: 2, principalDop: 10000 },
        CANCELLED: { count: 1, principalDop: 5000 }
      },
      loansBySize: {
        standard: { count: 12, principalDop: 60000 },
        larger: { count: 4, principalDop: 25000 },
        exception: { count: 2, principalDop: 5000 }
      },
      totalLoans: 18,
      totalPrincipalDop: 90000,
      totalExpectedRevenueDop: 108000,
      estimatedLossesPrincipalDop: 10000,
      estimatedRevenueLostDop: 12000,
      projectedCollectibleDop: 96000,
      projectedNetPositionDop: 88000,
      totalCollectedDop: 60000,
      defaultRateByCountPct: 11.1,
      defaultRateByCapitalPct: 11.1,
      collectionRatePct: 88.9,
      onTimePaymentRatePct: 75.5,
      portfolioAtRiskPct: 11.1
    },
    narrative: {
      executiveSummary: "La cartera creció de forma saludable durante el periodo.",
      keyInsights: [
        "La tasa de cobro se mantuvo sobre el 85%.",
        "Los préstamos estándar dominan el volumen."
      ],
      riskAreas: ["Dos préstamos entraron en mora este mes."],
      recommendation: "Reforzar el seguimiento de los préstamos con un ciclo de atraso."
    },
    generatedAt: new Date("2026-07-01T00:00:00Z"),
    ...overrides
  };
}

describe("performance report — validation", () => {
  it("rejects invalid/missing input with a structured ValidationError and produces no document", async () => {
    const bad = { metrics: {} };

    let jsonErr: unknown;
    try {
      await performanceReport.toJson(bad);
    } catch (e) {
      jsonErr = e;
    }
    expect(jsonErr).to.be.instanceOf(ValidationError);
    expect((jsonErr as ValidationError).code).to.equal("VALIDATION_ERROR");

    let pdfResult: Buffer | undefined;
    let pdfErr: unknown;
    try {
      pdfResult = await performanceReport.toPdf(bad, testDeps);
    } catch (e) {
      pdfErr = e;
    }
    expect(pdfErr).to.be.instanceOf(ValidationError);
    expect(pdfResult).to.equal(undefined);
  });
});

describe("performance report — JSON/PDF parity", () => {
  it("toJson returns the canonical KPI + breakdown + narrative model", async () => {
    const input = baseInput();
    const json = await performanceReport.toJson(input);

    expect(json.kpis.loansIssued).to.equal(18);
    expect(json.kpis.principalDisbursedDop).to.equal(90000);
    expect(json.kpis.estimatedLossDop).to.equal(10000);
    expect(json.statusBreakdown).to.have.length(4);
    expect(json.statusBreakdown.map((r) => r.status)).to.deep.equal([
      "ACTIVE",
      "COMPLETED",
      "DEFAULTED",
      "CANCELLED"
    ]);
    expect(json.sizeBreakdown).to.have.length(3);
    expect(json.narrative.executiveSummary).to.equal(input.narrative.executiveSummary);
  });

  it("toPdf renders a 2-page PDF composing the KPI grid, both breakdown tables, and the narrative sections", async () => {
    const input = baseInput();
    const pdf = await performanceReport.toPdf(input, testDeps);
    expect(pdf.subarray(0, 5).toString("latin1")).to.equal("%PDF-");
    const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page(?![s])/g) ?? []).length;
    expect(pageCount).to.equal(2);

    const data = buildPerformanceReportData(input);
    const text = documentText(data).join(" ");
    expect(text).to.include("PRÉSTAMOS EMITIDOS");
    expect(text).to.include("PÉRDIDA ESTIMADA");
    expect(text).to.include("Principal por estado");
    expect(text).to.include("Principal por categoría");
    expect(text).to.include("Cancelado");
    expect(text).to.include("Resumen ejecutivo");
    expect(text).to.include("Puntos clave");
    expect(text).to.include("Áreas de riesgo");
    expect(text).to.include("Recomendación");
    expect(text).to.include(input.narrative.executiveSummary);
    expect(text).to.include(input.narrative.recommendation);
  });
});
