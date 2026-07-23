/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Performance-trend data pipeline ("Desempeño en el Tiempo"). Answers a
 * momentum question — "are we heading the right way, and when do the loans
 * start making money?" — rather than a cumulative one. It computes, per month:
 *
 *  - operating profit of the month = interest collected − principal written off
 *    (growth-independent: it ignores capital already deployed);
 *  - the monthly collection rate (collected ÷ due that month);
 *  - the index of mora (default rate by capital) and PAR30, as of month-end.
 *
 * Plus a linear projection of the month operating profit crosses zero (the
 * loans "start making money"), and month-over-month deltas for the scorecard.
 *
 * As with the single-month report, this only reads the DB and hands a DB-free
 * series to the shared `performanceTrendReport` definition (`@mikro/common`).
 */
import {
  withErrorHandlingAndValidation,
  generatePerformanceTrendReportSchema,
  performanceTrendReport,
  type GeneratePerformanceTrendReportInput,
  type DbClient,
  type PerformanceTrendReportInput,
  type PerformanceTrendData,
  type PerformanceTrendMonth,
  type PerformanceTrendBreakevenMarker,
  type RenderReportDeps
} from "@mikro/common";
import { logger } from "../../logger.js";

/** Loan row with dated installment payments for as-of / flow aggregation. */
interface LoanRow {
  principal: { toString(): string } | number;
  status: string;
  termLength: number;
  paymentAmount: { toString(): string } | number;
  paymentFrequency: string;
  createdAt: Date;
  updatedAt: Date;
  payments: Array<{
    amount: { toString(): string } | number;
    status: string;
    paidAt: Date;
  }>;
}

function toNum(v: { toString(): string } | number): number {
  return typeof v === "number" ? v : Number(v.toString());
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const INTERVAL_DAYS: Record<string, number> = { DAILY: 1, WEEKLY: 7, BIWEEKLY: 14, MONTHLY: 30 };

const MONTHS_ABBR = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic"
];

/** How many months to project past the last actual month before giving up on a crossing. */
const MAX_PROJECTED_MONTHS = 6;

/**
 * Operations began January 2026 — never show (or anchor analytics on) a month
 * before then, even if a stray earlier loan exists. Mirrors the dashboard's
 * OPS_START floor (issue #168).
 */
const OPS_START_YEAR = 2026;
const OPS_START_MONTH = 1;

/** Least-squares line through {x,y} points; slope 0 when x has no spread. */
function linearFit(points: Array<{ x: number; y: number }>): { slope: number; intercept: number } {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const sx = points.reduce((s, p) => s + p.x, 0);
  const sy = points.reduce((s, p) => s + p.y, 0);
  const sxx = points.reduce((s, p) => s + p.x * p.x, 0);
  const sxy = points.reduce((s, p) => s + p.x * p.y, 0);
  const denom = n * sxx - sx * sx;
  const slope = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
  return { slope, intercept: (sy - slope * sx) / n };
}

function pad2(n: number): number | string {
  return n < 10 ? `0${n}` : n;
}
function monthKeyOf(year: number, month0: number): string {
  return `${year}-${pad2(month0 + 1)}`;
}

interface MonthBound {
  monthStart: Date;
  asOf: Date;
  monthKey: string;
  year: number;
  month0: number;
}

/** The trailing `months` month windows ending at `endDate` (current month clamped to `endDate`). */
function buildMonthBounds(endDate: Date, months: number): MonthBound[] {
  const anchor = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  const bounds: MonthBound[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    const monthEndFull = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
    const asOf = i === 0 ? endDate : monthEndFull;
    bounds.push({
      monthStart,
      asOf,
      monthKey: monthKeyOf(monthStart.getFullYear(), monthStart.getMonth()),
      year: monthStart.getFullYear(),
      month0: monthStart.getMonth()
    });
  }
  return bounds;
}

/** Cuotas elapsed for a loan by time `t` (0 before origination, capped at the term). */
function cyclesBy(createdAt: Date, t: Date, intervalDays: number, term: number): number {
  if (createdAt.getTime() > t.getTime()) return 0;
  const days = Math.floor((t.getTime() - createdAt.getTime()) / MS_PER_DAY);
  return Math.min(term, Math.max(0, Math.floor(days / intervalDays)));
}

/** Per-month accumulator. Flows are per-month; stocks are as-of month-end. */
interface MonthAgg {
  bound: MonthBound;
  monthInterest: number;
  monthLosses: number;
  monthCollected: number;
  monthDue: number;
  cumPrincipal: number;
  defaultedPrincipal: number;
  totalOutstanding: number;
  parOutstanding: number;
}

function labelFor(bound: MonthBound, isFirst: boolean): { label: string; yearTag?: string } {
  const label = MONTHS_ABBR[bound.month0];
  const yearTag = isFirst || bound.month0 === 0 ? `'${String(bound.year).slice(2)}` : undefined;
  return { label, yearTag };
}

/**
 * Compute the DB-free `performanceTrendReport` input: the monthly momentum
 * series (operating profit, collection rate, mora index, PAR30), a projected
 * "start making money" month, and month-over-month scorecard deltas.
 */
export async function computePerformanceTrendInput(
  client: DbClient,
  params: { endDate?: Date; months?: number }
): Promise<PerformanceTrendReportInput> {
  const endDate = params.endDate ?? new Date();
  const months = params.months ?? 12;

  const bounds = buildMonthBounds(endDate, months);
  const windowEnd = bounds[bounds.length - 1]!.asOf;

  logger.verbose("computing performance trend", {
    endDate: endDate.toISOString().slice(0, 10),
    months
  });

  const loans = await (
    client as unknown as { loan: { findMany: (args: unknown) => Promise<LoanRow[]> } }
  ).loan.findMany({
    where: { status: { not: "CANCELLED" }, createdAt: { lte: windowEnd } },
    include: {
      // Installments only (late fees are side income); REVERSED excluded by status.
      payments: {
        where: { status: { in: ["COMPLETED", "PARTIAL"] }, kind: "INSTALLMENT" },
        orderBy: { paidAt: "asc" }
      }
    }
  });

  const aggs: MonthAgg[] = bounds.map((bound) => ({
    bound,
    monthInterest: 0,
    monthLosses: 0,
    monthCollected: 0,
    monthDue: 0,
    cumPrincipal: 0,
    defaultedPrincipal: 0,
    totalOutstanding: 0,
    parOutstanding: 0
  }));

  for (const loan of loans) {
    const principal = toNum(loan.principal);
    const cuota = toNum(loan.paymentAmount);
    const term = loan.termLength ?? 10;
    const intervalDays =
      INTERVAL_DAYS[String(loan.paymentFrequency ?? "WEEKLY").toUpperCase()] ?? 7;
    const createdAt = new Date(loan.createdAt ?? 0);
    const status = String(loan.status ?? "").toUpperCase();
    const isDefaulted = status === "DEFAULTED";
    const isOpen = status === "ACTIVE" || isDefaulted;
    const expectedRepayment = cuota * term;
    // Share of each collected peso that is interest (vs. principal).
    const interestFraction =
      expectedRepayment > 0 ? Math.max(0, (expectedRepayment - principal) / expectedRepayment) : 0;

    // Loss recognition: a currently-DEFAULTED loan's unrecovered principal,
    // booked in the month it was marked defaulted (updatedAt as the proxy).
    const lossDate = new Date(loan.updatedAt ?? loan.createdAt ?? 0);
    let collectedUpToLoss = 0;
    if (isDefaulted) {
      for (const p of loan.payments) {
        if (new Date(p.paidAt).getTime() <= lossDate.getTime())
          collectedUpToLoss += toNum(p.amount);
      }
    }
    const lossAmount = isDefaulted ? Math.max(0, principal - collectedUpToLoss) : 0;

    for (const agg of aggs) {
      const { asOf, monthStart } = agg.bound;
      if (createdAt.getTime() > asOf.getTime()) continue;

      let collectedAsOf = 0;
      let collectedInMonth = 0;
      for (const p of loan.payments) {
        const paidAt = new Date(p.paidAt).getTime();
        if (paidAt > asOf.getTime()) continue;
        const amount = toNum(p.amount);
        collectedAsOf += amount;
        if (paidAt >= monthStart.getTime()) collectedInMonth += amount;
      }

      // Flows this month.
      agg.monthInterest += collectedInMonth * interestFraction;
      agg.monthCollected += collectedInMonth;
      const dueInMonth =
        Math.max(
          0,
          cyclesBy(createdAt, asOf, intervalDays, term) -
            cyclesBy(createdAt, monthStart, intervalDays, term)
        ) * cuota;
      agg.monthDue += dueInMonth;
      if (
        isDefaulted &&
        lossDate.getTime() >= monthStart.getTime() &&
        lossDate.getTime() <= asOf.getTime()
      ) {
        agg.monthLosses += lossAmount;
      }

      // Stocks as of month-end (mora index + PAR30).
      agg.cumPrincipal += principal;
      if (isDefaulted) agg.defaultedPrincipal += principal;
      if (isOpen) {
        const outstanding = Math.max(0, expectedRepayment - collectedAsOf);
        agg.totalOutstanding += outstanding;
        const cuotasPaid = cuota > 0 ? collectedAsOf / cuota : 0;
        const daysLate =
          Math.max(0, cyclesBy(createdAt, asOf, intervalDays, term) - cuotasPaid) * intervalDays;
        if (isDefaulted || daysLate > 30) agg.parOutstanding += outstanding;
      }
    }
  }

  const actualMonths: PerformanceTrendMonth[] = aggs.map((agg, i) => {
    const { label, yearTag } = labelFor(agg.bound, i === 0);
    return {
      monthKey: agg.bound.monthKey,
      label,
      yearTag,
      operatingProfitDop: Math.round(agg.monthInterest - agg.monthLosses),
      collectionRatePct: agg.monthDue > 0 ? (agg.monthCollected / agg.monthDue) * 100 : 0,
      defaultRatePct: agg.cumPrincipal > 0 ? (agg.defaultedPrincipal / agg.cumPrincipal) * 100 : 0,
      parPct: agg.totalOutstanding > 0 ? (agg.parOutstanding / agg.totalOutstanding) * 100 : 0,
      projected: false
    };
  });

  // ---- Trim to the active window (ops start ∧ first month with a portfolio) ----
  const n = actualMonths.length;
  const firstActiveIdx = aggs.findIndex((a) => a.cumPrincipal > 0);
  const opsStartIdx = bounds.findIndex(
    (b) => b.year > OPS_START_YEAR || (b.year === OPS_START_YEAR && b.month0 + 1 >= OPS_START_MONTH)
  );
  const activeStart = Math.min(
    n - 1,
    Math.max(firstActiveIdx < 0 ? n : firstActiveIdx, opsStartIdx < 0 ? 0 : opsStartIdx)
  );
  const activeActual = actualMonths.slice(activeStart);
  const lastActive = activeActual[activeActual.length - 1];

  // ---- Project when monthly operating profit crosses ≥ 0 ("start making money") ----
  const fitFrom = Math.max(activeStart, n - 6);
  const profitFit = linearFit(
    actualMonths.slice(fitFrom).map((m, k) => ({ x: fitFrom + k, y: m.operatingProfitDop }))
  );
  const last = aggs[n - 1]!.bound;
  const projected: PerformanceTrendMonth[] = [];
  let needProfit = !!lastActive && lastActive.operatingProfitDop <= 0 && profitFit.slope > 0;
  for (let step = 1; step <= MAX_PROJECTED_MONTHS && needProfit; step++) {
    const x = n - 1 + step;
    const d = new Date(last.year, last.month0 + step, 1);
    const profit = Math.round(profitFit.slope * x + profitFit.intercept);
    projected.push({
      monthKey: monthKeyOf(d.getFullYear(), d.getMonth()),
      label: MONTHS_ABBR[d.getMonth()],
      yearTag: d.getMonth() === 0 ? `'${String(d.getFullYear()).slice(2)}` : undefined,
      operatingProfitDop: profit,
      collectionRatePct: 0,
      defaultRatePct: 0,
      parPct: 0,
      projected: true
    });
    if (profit > 0) needProfit = false;
  }

  const markerLabel = (m: PerformanceTrendMonth) =>
    m.yearTag ? `${m.label} ${m.yearTag}` : m.label;
  const profitMarker = ((): PerformanceTrendBreakevenMarker => {
    if (!lastActive) return null;
    // "Making money" = strictly positive monthly profit; the earliest such month.
    const actualHit = activeActual.find((m) => m.operatingProfitDop > 0);
    if (actualHit)
      return { monthKey: actualHit.monthKey, label: markerLabel(actualHit), projected: false };
    const projHit = projected.find((m) => m.operatingProfitDop > 0);
    return projHit
      ? { monthKey: projHit.monthKey, label: markerLabel(projHit), projected: true }
      : null;
  })();

  const displayedActual = actualMonths.slice(activeStart);

  // ---- Scorecard deltas: current month vs. the previous month ----
  const cur = actualMonths[n - 1]!;
  const prev = actualMonths[Math.max(activeStart, n - 2)]!;

  return {
    period: {
      startDate: bounds[activeStart]!.monthStart.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10)
    },
    months: [...displayedActual, ...projected],
    breakeven: { profitPositive: profitMarker },
    kpis: {
      operatingProfitDop: cur.operatingProfitDop,
      operatingProfitDeltaDop: cur.operatingProfitDop - prev.operatingProfitDop,
      collectionRatePct: cur.collectionRatePct,
      collectionRateDeltaPts: cur.collectionRatePct - prev.collectionRatePct,
      defaultRatePct: cur.defaultRatePct,
      defaultRateDeltaPts: cur.defaultRatePct - prev.defaultRatePct,
      parPct: cur.parPct,
      parDeltaPts: cur.parPct - prev.parPct
    }
  };
}

export interface GeneratedPerformanceTrendReport {
  data: PerformanceTrendData;
  pdfBase64?: string;
  filename: string;
  mimeType: "application/pdf" | "application/json";
}

export interface GeneratePerformanceTrendOptions {
  /** Injected font loader for the PDF renderer — DI, no live gstatic fetch in tests. */
  renderDeps?: RenderReportDeps;
}

/**
 * Creates a function that generates the performance-trend report (momentum
 * series + profit projection via the shared `performanceTrendReport` definition).
 */
export function createGeneratePerformanceTrend(
  client: DbClient,
  options: GeneratePerformanceTrendOptions = {}
) {
  const fn = async (
    params: GeneratePerformanceTrendReportInput
  ): Promise<GeneratedPerformanceTrendReport> => {
    const format = params.format ?? "pdf";
    const input = await computePerformanceTrendInput(client, params);
    const data = await performanceTrendReport.toJson(input);
    const date = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      return { data, filename: `desempeno-tiempo-${date}.json`, mimeType: "application/json" };
    }

    const pdf = await performanceTrendReport.toPdf(input, options.renderDeps);
    logger.verbose("performance trend report generated", {
      months: input.months.length,
      pdfSizeKb: Math.round(pdf.length / 1024)
    });

    return {
      data,
      pdfBase64: pdf.toString("base64"),
      filename: `desempeno-tiempo-${date}.pdf`,
      mimeType: "application/pdf"
    };
  };

  return withErrorHandlingAndValidation(fn, generatePerformanceTrendReportSchema);
}
