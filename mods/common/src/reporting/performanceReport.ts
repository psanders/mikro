/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The performance report: a 2-page branded PDF (+ canonical JSON) built from
 * already-computed portfolio metrics and an already-generated narrative — the
 * narrative's LLM call happens upstream (apiserver), never here; this
 * definition only normalizes and lays out data it is handed.
 *
 * Input mirrors `PortfolioMetrics` + `ReportNarrative` (see
 * `mods/common/src/reports/types.ts`, the pre-migration source of truth for
 * these fields) field-for-field, kept DB-free and self-contained here so this
 * module has no dependency on the `reports/` tree being retired in a later
 * phase.
 */
import { z } from "zod/v4";
import { defineReport, type Report } from "./report.js";
import {
  brandHeader,
  verificationBanner,
  kpiGrid,
  dataTable,
  section,
  footerNote,
  page,
  BRAND,
  type KpiCell,
  type TableRow,
  type ReportElement
} from "./blocks.js";
import type { ReportDocument } from "./renderer.js";
import { formatDop, formatPct, formatDateEs } from "./format.js";

// ==================== Input schema (DB-free, metrics + narrative) ====================

const loanBucketInputSchema = z.object({
  count: z.number().int().nonnegative(),
  principalDop: z.number().nonnegative()
});

const portfolioMetricsInputSchema = z.object({
  period: z.object({ startDate: z.string(), endDate: z.string() }),
  loansByStatus: z.object({
    ACTIVE: loanBucketInputSchema,
    COMPLETED: loanBucketInputSchema,
    DEFAULTED: loanBucketInputSchema,
    CANCELLED: loanBucketInputSchema
  }),
  loansBySize: z.object({
    standard: loanBucketInputSchema,
    larger: loanBucketInputSchema,
    exception: loanBucketInputSchema
  }),
  totalLoans: z.number().int().nonnegative(),
  totalPrincipalDop: z.number().nonnegative(),
  totalExpectedRevenueDop: z.number(),
  estimatedLossesPrincipalDop: z.number(),
  estimatedRevenueLostDop: z.number(),
  projectedCollectibleDop: z.number(),
  projectedNetPositionDop: z.number(),
  totalCollectedDop: z.number(),
  defaultRateByCountPct: z.number(),
  defaultRateByCapitalPct: z.number(),
  collectionRatePct: z.number(),
  onTimePaymentRatePct: z.number().nullable(),
  portfolioAtRiskPct: z.number().nullable()
});

const reportNarrativeInputSchema = z.object({
  executiveSummary: z.string(),
  keyInsights: z.array(z.string()),
  riskAreas: z.array(z.string()),
  recommendation: z.string()
});

export const performanceReportInputSchema = z.object({
  metrics: portfolioMetricsInputSchema,
  narrative: reportNarrativeInputSchema,
  generatedAt: z.coerce.date().optional()
});

export type PerformanceReportInput = z.infer<typeof performanceReportInputSchema>;

// ==================== Canonical data model ====================

export type PerformanceLoanStatus = "ACTIVE" | "COMPLETED" | "DEFAULTED" | "CANCELLED";
export type PerformanceLoanSize = "standard" | "larger" | "exception";

export interface PerformanceReportKpis {
  loansIssued: number;
  principalDisbursedDop: number;
  collectionRatePct: number;
  projectedNetPositionDop: number;
  defaultRateByCountPct: number;
  defaultRateByCapitalPct: number;
  collectedToDateDop: number;
  estimatedLossDop: number;
}

export interface PerformanceReportStatusRow {
  status: PerformanceLoanStatus;
  label: string;
  count: number;
  principalDop: number;
}

export interface PerformanceReportSizeRow {
  size: PerformanceLoanSize;
  label: string;
  count: number;
  principalDop: number;
}

/** The full typed performance-report data model — canonical; the PDF adds no new data. */
export interface PerformanceReportData {
  generatedAt: string;
  period: { startDate: string; endDate: string };
  narrative: z.infer<typeof reportNarrativeInputSchema>;
  kpis: PerformanceReportKpis;
  statusBreakdown: PerformanceReportStatusRow[];
  sizeBreakdown: PerformanceReportSizeRow[];
}

const STATUS_LABELS: Record<PerformanceLoanStatus, string> = {
  ACTIVE: "Activo",
  COMPLETED: "Completamente pagado",
  DEFAULTED: "En mora",
  CANCELLED: "Cancelado"
};
// Order matches the approved Pencil "Desempeño" breakdown table.
const STATUS_ORDER: PerformanceLoanStatus[] = ["ACTIVE", "COMPLETED", "DEFAULTED", "CANCELLED"];

const SIZE_LABELS: Record<PerformanceLoanSize, string> = {
  standard: "Estándar",
  larger: "Mayor",
  exception: "Excepción"
};
const SIZE_ORDER: PerformanceLoanSize[] = ["standard", "larger", "exception"];

/** Build the canonical performance-report data model from validated input. */
export function buildPerformanceReportData(input: PerformanceReportInput): PerformanceReportData {
  const { metrics, narrative } = input;
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();

  const kpis: PerformanceReportKpis = {
    loansIssued: metrics.totalLoans,
    principalDisbursedDop: metrics.totalPrincipalDop,
    collectionRatePct: metrics.collectionRatePct,
    projectedNetPositionDop: metrics.projectedNetPositionDop,
    defaultRateByCountPct: metrics.defaultRateByCountPct,
    defaultRateByCapitalPct: metrics.defaultRateByCapitalPct,
    collectedToDateDop: metrics.totalCollectedDop,
    estimatedLossDop: metrics.estimatedLossesPrincipalDop
  };

  const statusBreakdown: PerformanceReportStatusRow[] = STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: metrics.loansByStatus[status].count,
    principalDop: metrics.loansByStatus[status].principalDop
  }));

  const sizeBreakdown: PerformanceReportSizeRow[] = SIZE_ORDER.map((size) => ({
    size,
    label: SIZE_LABELS[size],
    count: metrics.loansBySize[size].count,
    principalDop: metrics.loansBySize[size].principalDop
  }));

  return {
    generatedAt,
    period: metrics.period,
    narrative,
    kpis,
    statusBreakdown,
    sizeBreakdown
  };
}

// ==================== Presentation (page composition) ====================

function buildKpiCells(data: PerformanceReportData): KpiCell[] {
  const { kpis } = data;
  return [
    { label: "Préstamos emitidos", value: `${kpis.loansIssued}` },
    { label: "Principal desembolsado", value: formatDop(kpis.principalDisbursedDop) },
    { label: "Tasa de cobro", value: formatPct(kpis.collectionRatePct) },
    { label: "Posición neta proyectada", value: formatDop(kpis.projectedNetPositionDop) },
    { label: "Tasa de mora por N°", value: formatPct(kpis.defaultRateByCountPct) },
    { label: "Tasa de mora por capital", value: formatPct(kpis.defaultRateByCapitalPct) },
    { label: "Cobrado a la fecha", value: formatDop(kpis.collectedToDateDop) },
    { label: "Pérdida estimada", value: formatDop(kpis.estimatedLossDop), emphasize: true }
  ];
}

function buildStatusRows(data: PerformanceReportData): TableRow[] {
  return data.statusBreakdown.map((r) => ({
    cells: { status: r.label, count: `${r.count}`, principal: formatDop(r.principalDop) }
  }));
}

function buildSizeRows(data: PerformanceReportData): TableRow[] {
  return data.sizeBreakdown.map((r) => ({
    cells: { size: r.label, count: `${r.count}`, principal: formatDop(r.principalDop) }
  }));
}

/** Plain narrative paragraph — no dedicated block exists for free-flowing text. */
function paragraph(text: string): ReportElement {
  return {
    type: "div",
    props: {
      style: {
        fontFamily: "Inter",
        display: "flex",
        fontSize: "12px",
        fontWeight: 400,
        color: BRAND.ink,
        lineHeight: 1.5
      },
      children: text
    }
  };
}

/** Accent-bordered bullet list (mirrors the pre-migration narrative bullet style). */
function bulletList(items: string[], accentColor: string): ReportElement {
  return {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", gap: "6px" },
      children: items.map((item) => ({
        type: "div",
        props: {
          style: {
            fontFamily: "Inter",
            display: "flex",
            fontSize: "12px",
            fontWeight: 400,
            color: BRAND.ink,
            lineHeight: 1.4,
            paddingLeft: "14px",
            borderLeft: `3px solid ${accentColor}`
          },
          children: item
        }
      }))
    }
  };
}

/** Compose the 2-page performance-report document from the canonical data model. */
export function buildPerformanceReportDocument(data: PerformanceReportData): ReportDocument {
  const meta = [
    `Generado ${formatDateEs(data.generatedAt)}`,
    `Periodo ${data.period.startDate} — ${data.period.endDate}`
  ];

  const p1 = page([
    brandHeader({
      title: "Reporte de Desempeño",
      subtitle: "Cartera de préstamos — Mikro",
      meta
    }),
    kpiGrid({ cells: buildKpiCells(data), columns: 4 }),
    section("Principal por estado", [
      dataTable({
        columns: [
          { key: "status", header: "Estado", weight: 1.4 },
          { key: "count", header: "Cantidad", weight: 0.8, align: "right" },
          { key: "principal", header: "Principal (DOP)", weight: 1.3, align: "right" }
        ],
        rows: buildStatusRows(data)
      })
    ]),
    section("Principal por categoría", [
      dataTable({
        columns: [
          { key: "size", header: "Categoría", weight: 1.4 },
          { key: "count", header: "Cantidad", weight: 0.8, align: "right" },
          { key: "principal", header: "Principal (DOP)", weight: 1.3, align: "right" }
        ],
        rows: buildSizeRows(data)
      })
    ])
  ]);

  const p2Children: ReportElement[] = [
    section("Resumen ejecutivo", [paragraph(data.narrative.executiveSummary)])
  ];
  if (data.narrative.keyInsights.length > 0) {
    p2Children.push(
      section("Puntos clave", [bulletList(data.narrative.keyInsights, BRAND.blueDeep)])
    );
  }
  if (data.narrative.riskAreas.length > 0) {
    p2Children.push(
      section("Áreas de riesgo", [bulletList(data.narrative.riskAreas, BRAND.orangeDeep)])
    );
  }
  p2Children.push(
    section("Recomendación", [
      verificationBanner({
        headline: "Recomendación",
        explanation: data.narrative.recommendation,
        tone: "info"
      })
    ])
  );
  p2Children.push(
    footerNote([
      `Reporte de desempeño · Generado ${formatDateEs(data.generatedAt)} · Documento generado automáticamente por Mikro.`
    ])
  );

  const p2 = page(p2Children);

  return { pages: [{ layout: p1 }, { layout: p2 }] };
}

/** The performance report: validated `PortfolioMetrics` + `ReportNarrative` in, JSON/PDF out. */
export const performanceReport: Report<PerformanceReportData> = defineReport({
  name: "performance",
  inputSchema: performanceReportInputSchema,
  buildData: buildPerformanceReportData,
  toDocument: buildPerformanceReportDocument
});
