/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The performance-trend report ("Desempeño en el Tiempo"). A momentum view:
 * are the numbers improving month over month, and when do the loans start
 * making money? The hero is the MONTHLY operating profit (interest collected −
 * new defaults) crossing from loss into profit — a flow that ignores capital
 * already deployed, so early sunk investment doesn't drown the signal. It's
 * supported by a month-over-month scorecard and three momentum trends
 * (collection rate vs. target, mora index, PAR30).
 *
 * Like the other reports this only normalizes and lays out an already-computed
 * series (see apiserver `createGeneratePerformanceTrend`).
 */
import { z } from "zod/v4";
import { defineReport, type Report } from "./report.js";
import { composeReportPages } from "./compose.js";
import {
  BRAND,
  brandHeader,
  kpiGrid,
  section,
  type KpiCell,
  type PillTone,
  type ReportElement
} from "./blocks.js";
import { formatDateEs } from "./format.js";

// ==================== Input schema (DB-free, computed series) ====================

const trendMonthInputSchema = z.object({
  monthKey: z.string(),
  label: z.string(),
  yearTag: z.string().optional(),
  /** Operating profit of the month = interest collected − principal written off (RD$). */
  operatingProfitDop: z.number(),
  /** Collection rate of the month = collected ÷ due that month (%). */
  collectionRatePct: z.number(),
  /** Default rate by capital as of month-end (índice de mora) (%). */
  defaultRatePct: z.number(),
  /** PAR30 as of month-end (%). */
  parPct: z.number(),
  projected: z.boolean().default(false)
});

const breakevenMarkerInputSchema = z
  .object({ monthKey: z.string(), label: z.string(), projected: z.boolean() })
  .nullable();

export const performanceTrendReportInputSchema = z.object({
  period: z.object({ startDate: z.string(), endDate: z.string() }),
  /** Actual months followed by any projected months, chronological. */
  months: z.array(trendMonthInputSchema).min(1),
  breakeven: z.object({
    /** The month monthly operating profit first turns ≥ 0. */
    profitPositive: breakevenMarkerInputSchema
  }),
  /** Scorecard values with month-over-month deltas. */
  kpis: z.object({
    operatingProfitDop: z.number(),
    operatingProfitDeltaDop: z.number(),
    collectionRatePct: z.number(),
    collectionRateDeltaPts: z.number(),
    defaultRatePct: z.number(),
    defaultRateDeltaPts: z.number(),
    parPct: z.number(),
    parDeltaPts: z.number()
  }),
  generatedAt: z.coerce.date().optional()
});

export type PerformanceTrendReportInput = z.infer<typeof performanceTrendReportInputSchema>;

// ==================== Canonical data model ====================

export type PerformanceTrendMonth = z.infer<typeof trendMonthInputSchema>;
export type PerformanceTrendBreakevenMarker = z.infer<typeof breakevenMarkerInputSchema>;

/** The full typed performance-trend data model — canonical; the PDF adds no new data. */
export interface PerformanceTrendData {
  generatedAt: string;
  period: { startDate: string; endDate: string };
  months: PerformanceTrendMonth[];
  breakeven: { profitPositive: PerformanceTrendBreakevenMarker };
  kpis: PerformanceTrendReportInput["kpis"];
}

/** Build the canonical performance-trend data model from validated input. */
export function buildPerformanceTrendReportData(
  input: PerformanceTrendReportInput
): PerformanceTrendData {
  return {
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    period: input.period,
    months: input.months,
    breakeven: input.breakeven,
    kpis: input.kpis
  };
}

// ==================== Local formatting ====================

function formatDopCompact(n: number): string {
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  let body: string;
  if (abs >= 1_000_000)
    body = `${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  else if (abs >= 1_000) body = `${Math.round(abs / 1_000)}K`;
  else body = `${Math.round(abs)}`;
  return `${sign}RD$${body}`;
}

function formatPct0(n: number): string {
  return `${Math.round(n)}%`;
}
function formatPct1(n: number): string {
  return `${n.toFixed(1)}%`;
}

/** "▲ +5 pts" / "▼ −2 pts" / "▲ +RD$3K". */
function deltaLabel(delta: number, unit: "pts" | "money"): string {
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "•";
  if (unit === "money") {
    return `${arrow} ${delta >= 0 ? "+" : "−"}${formatDopCompact(Math.abs(delta))}`;
  }
  return `${arrow} ${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)} pts`;
}

/** Higher-is-better (profit, collection) vs. lower-is-better (mora, PAR). */
function deltaTone(delta: number, lowerIsBetter: boolean): PillTone {
  const improving = lowerIsBetter ? delta <= 0 : delta >= 0;
  return improving ? "paid" : "overdue";
}

function formatWindowLabel(startDate: string, endDate: string): string {
  const fmt = (d: string) => {
    const label = new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("es-DO", {
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}

// ==================== satori element helpers ====================

function box(style: Record<string, unknown>, children: ReportElement[] = []): ReportElement {
  return { type: "div", props: { style: { display: "flex", ...style }, children } };
}
function text(content: string, style: Record<string, unknown> = {}): ReportElement {
  return {
    type: "div",
    props: { style: { fontFamily: "Inter", display: "flex", ...style }, children: content }
  };
}

/** flexGrow:1, flexBasis:0 column cell — the building block of every bar chart here. */
function barCell(
  children: ReportElement[],
  justify: "flex-end" | "flex-start" | "center"
): ReportElement {
  return box(
    {
      flexGrow: 1,
      flexBasis: "0px",
      minWidth: "0px",
      flexDirection: "column",
      justifyContent: justify,
      alignItems: "center",
      padding: "0 4px"
    },
    children
  );
}

function bar(
  heightPx: number,
  color: string,
  corner: "top" | "bottom",
  hollow = false
): ReportElement {
  return box({
    width: "100%",
    height: `${Math.max(0, heightPx)}px`,
    backgroundColor: hollow ? (color === BRAND.green ? BRAND.greenBg : BRAND.amberBg) : color,
    ...(hollow ? { border: `1.5px solid ${color}` } : {}),
    ...(corner === "top"
      ? { borderTopLeftRadius: "4px", borderTopRightRadius: "4px" }
      : { borderBottomLeftRadius: "4px", borderBottomRightRadius: "4px" })
  });
}

function monthLabels(months: PerformanceTrendMonth[]): ReportElement {
  return box(
    { flexDirection: "row", width: "100%", paddingTop: "6px" },
    months.map((m) =>
      barCell(
        [
          text(m.label, {
            fontSize: "9px",
            fontWeight: m.projected ? 500 : 600,
            color: m.projected ? BRAND.muted : BRAND.ink
          })
        ],
        "center"
      )
    )
  );
}

function chartCard(children: ReportElement[]): ReportElement {
  return box(
    {
      flexDirection: "column",
      width: "100%",
      padding: "16px 18px",
      borderRadius: "11px",
      border: `1px solid ${BRAND.border}`,
      backgroundColor: BRAND.white
    },
    children
  );
}

function legendItem(color: string, label: string, hollow = false): ReportElement {
  return box({ flexDirection: "row", alignItems: "center", gap: "7px" }, [
    box({
      width: "12px",
      height: "12px",
      borderRadius: "3px",
      backgroundColor: hollow ? BRAND.white : color,
      ...(hollow ? { border: `1.5px solid ${color}` } : {})
    }),
    text(label, { fontSize: "11px", fontWeight: 500, color: BRAND.muted })
  ]);
}

// ==================== Scorecard ====================

function buildScorecardCells(data: PerformanceTrendData): KpiCell[] {
  const k = data.kpis;
  return [
    {
      label: "Ganancia del mes",
      value: formatDopCompact(k.operatingProfitDop),
      emphasize: k.operatingProfitDop < 0,
      pill: {
        value: deltaLabel(k.operatingProfitDeltaDop, "money"),
        tone: deltaTone(k.operatingProfitDeltaDop, false)
      },
      subtext: "interés − impagos"
    },
    {
      label: "Cobro del mes",
      value: formatPct0(k.collectionRatePct),
      pill: {
        value: deltaLabel(k.collectionRateDeltaPts, "pts"),
        tone: deltaTone(k.collectionRateDeltaPts, false)
      },
      subtext: "cobrado ÷ vencido"
    },
    {
      label: "Índice de mora",
      value: formatPct1(k.defaultRatePct),
      pill: {
        value: deltaLabel(k.defaultRateDeltaPts, "pts"),
        tone: deltaTone(k.defaultRateDeltaPts, true)
      },
      subtext: "capital en impago"
    },
    {
      label: "PAR 30d",
      value: formatPct0(k.parPct),
      pill: { value: deltaLabel(k.parDeltaPts, "pts"), tone: deltaTone(k.parDeltaPts, true) },
      subtext: "saldo +30d vencido"
    }
  ];
}

// ==================== Hero: monthly operating profit ====================

const PROFIT_PLOT = 200;

function profitChart(data: PerformanceTrendData): ReportElement {
  const months = data.months;
  const vals = months.map((m) => m.operatingProfitDop);
  const posMax = Math.max(0, ...vals);
  const negMax = Math.max(0, ...vals.map((v) => -v));
  const scale = PROFIT_PLOT / (posMax + negMax || 1);
  const topH = Math.max(2, Math.round(posMax * scale));
  const botH = Math.max(2, Math.round(negMax * scale));
  const winKey = data.breakeven.profitPositive?.monthKey;

  const markerRow = box(
    { flexDirection: "row", width: "100%", height: "34px" },
    months.map((m) => {
      if (winKey && m.monthKey === winKey) {
        return barCell(
          [
            box({ padding: "3px 9px", borderRadius: "999px", backgroundColor: BRAND.green }, [
              text("Empiezan a ganar", { fontSize: "9px", fontWeight: 700, color: BRAND.white })
            ]),
            text("▼", { fontSize: "10px", fontWeight: 700, color: BRAND.green })
          ],
          "flex-end"
        );
      }
      return barCell([], "flex-end");
    })
  );

  const topBand = box(
    { flexDirection: "row", width: "100%", height: `${topH}px` },
    months.map((m) =>
      barCell(
        m.operatingProfitDop > 0
          ? [bar(m.operatingProfitDop * scale, BRAND.green, "top", m.projected)]
          : [],
        "flex-end"
      )
    )
  );
  const zeroLine = box({ width: "100%", height: "1.5px", backgroundColor: BRAND.muted });
  const bottomBand = box(
    { flexDirection: "row", width: "100%", height: `${botH}px` },
    months.map((m) =>
      barCell(
        m.operatingProfitDop < 0
          ? [bar(-m.operatingProfitDop * scale, BRAND.orangeDeep, "bottom", m.projected)]
          : [],
        "flex-start"
      )
    )
  );

  const legend = box({ flexDirection: "row", width: "100%", gap: "18px", paddingTop: "12px" }, [
    legendItem(BRAND.orangeDeep, "Pierde en el mes"),
    legendItem(BRAND.green, "Gana en el mes"),
    legendItem(BRAND.muted, "Proyección", true)
  ]);

  return section(
    "¿Cuándo empiezan a ganar los préstamos?",
    [chartCard([markerRow, topBand, zeroLine, bottomBand, monthLabels(months), legend])],
    {
      annotation: "Ganancia operativa del mes · interés cobrado − impagos · RD$ miles"
    }
  );
}

function profitCallout(data: PerformanceTrendData): ReportElement {
  const m = data.breakeven.profitPositive;
  const headline = m
    ? m.projected
      ? `A ritmo actual, los préstamos empiezan a dar ganancia en ${m.label}.`
      : `Desde ${m.label}, el interés cobrado ya supera los impagos en la mayoría de los meses.`
    : "Los préstamos aún no proyectan generar ganancia mensual en el horizonte visible.";

  return box(
    {
      flexDirection: "row",
      width: "100%",
      gap: "14px",
      padding: "14px 16px",
      borderRadius: "11px",
      backgroundColor: BRAND.greenBg,
      alignItems: "flex-start"
    },
    [
      box(
        {
          width: "38px",
          height: "38px",
          borderRadius: "999px",
          backgroundColor: BRAND.green,
          alignItems: "center",
          justifyContent: "center"
        },
        [
          // ▲ (U+25B2) renders in the report font; the scorecard pills use it too.
          text("▲", { fontSize: "15px", fontWeight: 700, color: BRAND.white })
        ]
      ),
      box({ flexDirection: "column", flexGrow: 1, gap: "5px" }, [
        text(headline, { fontSize: "15px", fontWeight: 700, color: BRAND.ink, lineHeight: 1.35 }),
        text(
          "Cada mes en verde, el interés cobrado supera los impagos nuevos: la operación gana ese mes, independientemente del capital ya colocado.",
          {
            fontSize: "12px",
            fontWeight: 500,
            color: BRAND.ink,
            lineHeight: 1.4
          }
        ),
        text(
          "No mide recuperar el capital invertido — mide si la operación, hoy, gana o pierde mes a mes.",
          {
            fontSize: "11px",
            fontWeight: 500,
            fontStyle: "italic",
            color: BRAND.muted,
            lineHeight: 1.4
          }
        )
      ])
    ]
  );
}

// ==================== Collection rate vs. target ====================

const COBRO_TARGET = 90;
const COBRO_BARS_H = 128;

function collectionChart(actual: PerformanceTrendMonth[]): ReportElement {
  const scale = COBRO_BARS_H / COBRO_TARGET; // target line at the top of the bars band
  const first = actual[0]?.collectionRatePct ?? 0;
  const last = actual[actual.length - 1]?.collectionRatePct ?? 0;
  const delta = Math.round(last - first);

  const targetZone = box(
    {
      flexDirection: "row",
      width: "100%",
      height: "22px",
      justifyContent: "flex-end",
      alignItems: "flex-start",
      borderBottom: `1.5px solid ${BRAND.green}`
    },
    [text(`Meta ${COBRO_TARGET}%`, { fontSize: "10px", fontWeight: 700, color: BRAND.green })]
  );
  const bars = box(
    { flexDirection: "row", width: "100%", height: `${COBRO_BARS_H}px`, alignItems: "flex-end" },
    actual.map((m) =>
      barCell(
        [
          text(formatPct0(m.collectionRatePct), {
            fontSize: "9px",
            fontWeight: 700,
            color: BRAND.bluePrimary
          }),
          bar(Math.min(COBRO_BARS_H, m.collectionRatePct * scale), BRAND.bluePrimary, "top")
        ],
        "flex-end"
      )
    )
  );
  const note = box(
    { flexDirection: "row", width: "100%", gap: "7px", alignItems: "center", paddingTop: "12px" },
    [
      text(delta >= 0 ? "▲" : "▼", {
        fontSize: "11px",
        fontWeight: 700,
        color: delta >= 0 ? BRAND.green : BRAND.red
      }),
      text(
        delta >= 0
          ? `Subiendo +${delta} pts en el período — la disciplina de cobro mejora.`
          : `Bajando ${delta} pts en el período — la cobranza se está debilitando.`,
        { fontSize: "12px", fontWeight: 500, color: BRAND.muted }
      )
    ]
  );

  return section(
    "Tasa de cobro mensual",
    [
      chartCard([
        box({ flexDirection: "column", width: "100%" }, [targetZone, bars]),
        monthLabels(actual),
        note
      ])
    ],
    {
      annotation: "Cobrado ÷ vencido cada mes"
    }
  );
}

// ==================== Mini momentum trend (mora, PAR) ====================

function miniTrend(params: {
  title: string;
  actual: PerformanceTrendMonth[];
  value: (m: PerformanceTrendMonth) => number;
  color: string;
  lowerIsBetter: boolean;
  currentLabel: string;
}): ReportElement {
  const { title, actual, value, color, lowerIsBetter, currentLabel } = params;
  const vals = actual.map(value);
  const maxV = Math.max(0.001, ...vals);
  const H = 96;
  const scale = H / (maxV * 1.1);
  const first = vals[0] ?? 0;
  const last = vals[vals.length - 1] ?? 0;
  const improving = lowerIsBetter ? last < first : last > first;
  const arrow = (lowerIsBetter ? last <= first : last >= first)
    ? lowerIsBetter
      ? "▼"
      : "▲"
    : lowerIsBetter
      ? "▲"
      : "▼";
  const chipFg = improving ? BRAND.green : BRAND.red;
  const chipBg = improving ? BRAND.greenBg : BRAND.redBg;
  // Signed change over the window (positive = the metric rose), so a rising PAR
  // reads "+15 pts", not "−15 pts".
  const signedDelta = Math.round(last - first);

  const head = box(
    { flexDirection: "row", width: "100%", justifyContent: "space-between", alignItems: "center" },
    [
      text(title, { fontSize: "15px", fontWeight: 700, color: BRAND.ink }),
      box(
        {
          flexDirection: "row",
          alignItems: "center",
          gap: "4px",
          padding: "3px 9px",
          borderRadius: "999px",
          backgroundColor: chipBg
        },
        [
          text(arrow, { fontSize: "10px", fontWeight: 700, color: chipFg }),
          text(improving ? "mejorando" : "empeorando", {
            fontSize: "12px",
            fontWeight: 700,
            color: chipFg
          })
        ]
      )
    ]
  );
  const bars = box(
    { flexDirection: "row", width: "100%", height: `${H}px`, alignItems: "flex-end" },
    actual.map((m) => barCell([bar(value(m) * scale, color, "top")], "flex-end"))
  );
  const foot = box(
    {
      flexDirection: "row",
      width: "100%",
      justifyContent: "space-between",
      alignItems: "flex-end",
      paddingTop: "10px",
      marginTop: "2px",
      borderTop: `1px solid ${BRAND.border}`
    },
    [
      text(currentLabel, {
        fontSize: "24px",
        fontWeight: 700,
        color: BRAND.ink,
        letterSpacing: "-0.5px"
      }),
      text(`${signedDelta >= 0 ? "+" : "−"}${Math.abs(signedDelta)} pts en el período`, {
        fontSize: "11px",
        fontWeight: 500,
        color: BRAND.muted
      })
    ]
  );

  return box(
    {
      flexDirection: "column",
      flexGrow: 1,
      flexBasis: "0px",
      minWidth: "0px",
      gap: "12px",
      padding: "16px 18px",
      borderRadius: "11px",
      border: `1px solid ${BRAND.border}`,
      backgroundColor: BRAND.white
    },
    [head, bars, monthLabels(actual), foot]
  );
}

// ==================== Presentation (page composition) ====================

export function buildPerformanceTrendReportDocument(data: PerformanceTrendData): ReportElement[][] {
  const meta = [
    { label: "Generado", value: formatDateEs(data.generatedAt) },
    { label: "Período", value: formatWindowLabel(data.period.startDate, data.period.endDate) }
  ];
  const actual = data.months.filter((m) => !m.projected);

  const page1: ReportElement[] = [
    brandHeader({
      eyebrow: "Reporte · Tendencia",
      title: "Desempeño en el Tiempo",
      subtitle: "Momentum del negocio y punto de ganancia",
      meta
    }),
    section("¿Vamos en la dirección correcta?", [
      kpiGrid({ cells: buildScorecardCells(data), columns: 4 })
    ]),
    profitChart(data),
    profitCallout(data)
  ];

  const page2: ReportElement[] = [
    brandHeader({
      eyebrow: "Reporte · Tendencia",
      title: "Desempeño en el Tiempo",
      subtitle: "¿Están mejorando los números?",
      meta
    }),
    collectionChart(actual),
    box({ flexDirection: "row", width: "100%", gap: "20px" }, [
      miniTrend({
        title: "Índice de mora",
        actual,
        value: (m) => m.defaultRatePct,
        color: BRAND.orangePrimary,
        lowerIsBetter: true,
        currentLabel: formatPct1(data.kpis.defaultRatePct)
      }),
      miniTrend({
        title: "PAR 30 días",
        actual,
        value: (m) => m.parPct,
        color: BRAND.red,
        lowerIsBetter: true,
        currentLabel: formatPct0(data.kpis.parPct)
      })
    ])
  ];

  return [page1, page2];
}

function toDocument(data: PerformanceTrendData) {
  const pageBodies = buildPerformanceTrendReportDocument(data);
  const footerContext = `Mikro SRL — Desempeño en el tiempo · Generado ${formatDateEs(data.generatedAt)}`;
  return composeReportPages(pageBodies, () => [footerContext]);
}

/** The performance-trend report: validated computed series in, JSON/PDF out. */
export const performanceTrendReport: Report<PerformanceTrendData> = defineReport({
  name: "performance-trend",
  inputSchema: performanceTrendReportInputSchema,
  buildData: buildPerformanceTrendReportData,
  toDocument
});
