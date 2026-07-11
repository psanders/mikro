/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The performance report: a branded PDF (+ canonical JSON) built from
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
import { composeReportPages } from "./compose.js";
import {
  BRAND,
  brandHeader,
  kpiGrid,
  dataTable,
  section,
  noteCard,
  type KpiCell,
  type TableRow,
  type ReportElement
} from "./blocks.js";
import {
  SECTION_TITLE_HEIGHT,
  FOOTER_HEIGHT,
  CONTENT_WIDTH,
  estimateWrappedLines,
  paginateByEstimatedHeight,
  verificationBannerHeight,
  SAFETY_FACTOR
} from "./layout.js";
import { PAGE_HEIGHT, PAGE_PADDING, PAGE_GAP } from "./blocks.js";
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

/** Month + year, e.g. "Julio 2026" — the Pencil header's "Período" meta value; purely a display of `period.startDate`. */
function formatMonthYearEs(d: string): string {
  const label = new Date(`${d}T00:00:00Z`).toLocaleDateString("es-DO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildKpiCells(data: PerformanceReportData): KpiCell[] {
  const { kpis } = data;
  return [
    { label: "Préstamos emitidos", value: `${kpis.loansIssued}` },
    { label: "Principal desembolsado", value: formatDop(kpis.principalDisbursedDop) },
    { label: "Tasa de cobro", value: formatPct(kpis.collectionRatePct), subtext: "proyectada" },
    { label: "Posición neta proyectada", value: formatDop(kpis.projectedNetPositionDop) },
    { label: "Tasa de mora por N°", value: formatPct(kpis.defaultRateByCountPct) },
    { label: "Tasa de mora por capital", value: formatPct(kpis.defaultRateByCapitalPct) },
    { label: "Cobrado a la fecha", value: formatDop(kpis.collectedToDateDop) },
    {
      label: "Pérdida estimada",
      value: formatDop(kpis.estimatedLossDop),
      subtext: "capital en default",
      emphasize: true
    }
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
        fontWeight: 500,
        color: BRAND.ink,
        lineHeight: 1.5
      },
      children: text
    }
  };
}

/** Small bold sub-heading (e.g. "Resumen ejecutivo") under a `section()`'s 16px title. */
function subheading(text: string): ReportElement {
  return {
    type: "div",
    props: {
      style: {
        fontFamily: "Inter",
        display: "flex",
        fontSize: "13px",
        fontWeight: 700,
        color: BRAND.ink
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
            fontWeight: 500,
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

/** Two columns of equal width, side by side (e.g. "Puntos clave" / "Áreas de riesgo"). */
function sideBySide(children: ReportElement[]): ReportElement {
  return {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "row", gap: "24px", width: "100%" },
      children: children.map((c) => ({
        type: "div",
        props: {
          style: { display: "flex", flexDirection: "column", flexGrow: 1, flexBasis: "0px" },
          children: [c]
        }
      }))
    }
  };
}

function bulletColumn(title: string, items: string[], accentColor: string): ReportElement {
  return {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", gap: "8px", width: "100%" },
      children: [subheading(title), bulletList(items, accentColor)]
    }
  };
}

const HALF_CONTENT_WIDTH = (CONTENT_WIDTH - 24) / 2; // minus the sideBySide gap, split in two

/** Estimated height of the "Puntos clave"/"Áreas de riesgo" bullet-list row (the taller of the two columns). */
function estimateBulletColumnHeight(items: string[]): number {
  if (items.length === 0) return 0;
  const subheadingHeight = 16 + 8; // 13px line + gap to the list
  const itemsHeight = items.reduce(
    (sum, item) => sum + estimateWrappedLines(item, HALF_CONTENT_WIDTH) * 17 + 6,
    -6 // last item has no trailing gap
  );
  return subheadingHeight + itemsHeight;
}

/** Estimated height of the "Resumen ejecutivo" sub-heading + paragraph. */
function estimateParagraphSectionHeight(text: string): number {
  const subheadingHeight = 16 + 10;
  const lines = estimateWrappedLines(text, CONTENT_WIDTH);
  return subheadingHeight + lines * 18; // 12px/1.5 line-height, rounded up
}

/** Estimated height of a `noteCard` with a heading + one paragraph of `text`. */
function estimateNoteCardHeight(text: string): number {
  return verificationBannerHeight(estimateWrappedLines(text, CONTENT_WIDTH));
}

/**
 * Compose the performance-report document from the canonical data model.
 * Page 1 is fixed-size (header, KPI grid, the two small breakdown tables —
 * neither ever grows past a handful of rows). The narrative (executive
 * summary, key insights, risk areas, recommendation) is LLM-generated and of
 * unknown length, so it's laid out on its own page(s) and paginated by
 * estimated height (see `layout.ts`'s `paginateByEstimatedHeight`) instead of
 * being squeezed to fit — a long narrative spills onto a further page rather
 * than risking the fixed-page overflow that crashes the renderer (#202).
 */
export function buildPerformanceReportDocument(data: PerformanceReportData): ReportDocument {
  const meta = [
    { label: "Generado", value: formatDateEs(data.generatedAt) },
    { label: "Período", value: formatMonthYearEs(data.period.startDate) }
  ];

  const page1: ReportElement[] = [
    brandHeader({
      eyebrow: "Reporte",
      title: "Reporte de Desempeño",
      subtitle: "Salud de la cartera y proyección financiera",
      meta
    }),
    kpiGrid({ cells: buildKpiCells(data), columns: 4 }),
    section("Distribución de cartera", [
      sideBySide([
        section("Principal por estado", [
          dataTable({
            columns: [
              // 1.9: "Completamente pagado" is the widest status label and
              // ellipsized at 1.4 in a half-page table — Cant. is 1-2 digits
              // and never needs more than 0.5.
              { key: "status", header: "Categoría", weight: 1.9, variant: "primary" },
              { key: "count", header: "Cant.", weight: 0.5, align: "right", variant: "secondary" },
              {
                key: "principal",
                header: "Principal (DOP)",
                weight: 1.3,
                align: "right",
                variant: "money"
              }
            ],
            rows: buildStatusRows(data)
          })
        ]),
        section("Principal por categoría", [
          dataTable({
            columns: [
              { key: "size", header: "Categoría", weight: 1.9, variant: "primary" },
              { key: "count", header: "Cant.", weight: 0.5, align: "right", variant: "secondary" },
              {
                key: "principal",
                header: "Principal (DOP)",
                weight: 1.3,
                align: "right",
                variant: "money"
              }
            ],
            rows: buildSizeRows(data)
          })
        ])
      ])
    ])
  ];

  // Two narrative units: the analysis (executive summary + key
  // insights/risk-areas bullets) and the recommendation card. Neither splits
  // internally — each is paginated as a whole unit onto page 2+.
  type NarrativeItem = { el: ReportElement; height: number };
  const items: NarrativeItem[] = [];

  const hasInsightsOrRisks =
    data.narrative.keyInsights.length > 0 || data.narrative.riskAreas.length > 0;
  const analysisChildren: ReportElement[] = [
    subheading("Resumen ejecutivo"),
    paragraph(data.narrative.executiveSummary)
  ];
  let analysisHeight = estimateParagraphSectionHeight(data.narrative.executiveSummary);
  if (hasInsightsOrRisks) {
    analysisChildren.push(
      sideBySide([
        data.narrative.keyInsights.length > 0
          ? bulletColumn("Puntos clave", data.narrative.keyInsights, BRAND.blueDeep)
          : {
              type: "div",
              props: { style: { display: "flex", flexBasis: "0px", flexGrow: 1 }, children: [] }
            },
        data.narrative.riskAreas.length > 0
          ? bulletColumn("Áreas de riesgo", data.narrative.riskAreas, BRAND.orangeDeep)
          : {
              type: "div",
              props: { style: { display: "flex", flexBasis: "0px", flexGrow: 1 }, children: [] }
            }
      ])
    );
    analysisHeight +=
      24 + // gap between the resumen paragraph and the bullets row
      Math.max(
        estimateBulletColumnHeight(data.narrative.keyInsights),
        estimateBulletColumnHeight(data.narrative.riskAreas)
      );
  }
  items.push({
    el: section("Análisis del período", analysisChildren),
    height: SECTION_TITLE_HEIGHT + analysisHeight
  });

  items.push({
    el: noteCard({ heading: "Recomendación", lines: [data.narrative.recommendation] }),
    height: estimateNoteCardHeight(data.narrative.recommendation)
  });

  const narrativePageBudget = Math.floor(
    (PAGE_HEIGHT - 2 * PAGE_PADDING - FOOTER_HEIGHT - PAGE_GAP) * SAFETY_FACTOR
  );
  const narrativePages = paginateByEstimatedHeight(
    items,
    (item) => item.height,
    narrativePageBudget,
    narrativePageBudget,
    PAGE_GAP
  );

  const pageBodies: ReportElement[][] = [
    page1,
    ...narrativePages.map((page) => page.map((it) => it.el))
  ];

  const footerContext = `Mikro SRL — Reporte de desempeño · Generado ${formatDateEs(data.generatedAt)}`;
  return composeReportPages(pageBodies, () => [footerContext]);
}

/** The performance report: validated `PortfolioMetrics` + `ReportNarrative` in, JSON/PDF out. */
export const performanceReport: Report<PerformanceReportData> = defineReport({
  name: "performance",
  inputSchema: performanceReportInputSchema,
  buildData: buildPerformanceReportData,
  toDocument: buildPerformanceReportDocument
});
