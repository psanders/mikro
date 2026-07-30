/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Calibrates a ProjectionConfig for the Modelo engine from a mikro.db copy.
 *
 * Reads the SQLite file directly (offline — no apiserver), groups loans into
 * calendar-aligned cohorts, and prefills the engine's levers from the most
 * recent cohorts so the early, noisier months don't drag the numbers. The
 * per-cohort table is returned alongside so the user can see exactly what was
 * included and override any prefill interactively.
 *
 * Node-only (node:sqlite): exposed via `@mikro/common/modelo`, deliberately
 * kept out of the root barrel and the browser-safe `./projection` subpath.
 */
import type { FrecuenciaPago, ProjectionConfig } from "../projection/engine.js";
import { effectiveDefaultRate } from "./collectionRate.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How much of the currently past-due money the prefill assumes is eventually
 * collected. Deliberately a middle assumption, not a measurement: the CLI
 * exposes it as a lever and shows both extremes.
 */
export const DEFAULT_RECOVERY_ASSUMPTION = 0.5;

export type ModeloCohort = {
  /** e.g. "2026-01..2026-02" */
  label: string;
  startMonth: string;
  loans: number;
  principal: number;
  contractValue: number;
  dueToDate: number;
  collected: number;
  collectionRate: number;
  defaultedLoans: number;
  defaultedPrincipal: number;
};

export type ModeloCalibration = {
  asOf: string;
  dbPath: string;
  cohortMonths: number;
  recentCohorts: number;
  cohorts: ModeloCohort[];
  facts: {
    /** Recency-weighted collection rate over the recent cohorts (0-1). */
    collectionRate: number;
    /** Net principal lost to defaults over the whole book (0-1). */
    lossRate: number;
    /** Share of installment payment events that carried a late fee (0-1). */
    lateShare: number;
    opexMonthlyAvg: number;
    ledgerCash: number;
    /** Principal still on the street across ACTIVE loans. */
    outstandingPrincipal: number;
    /** Amount past schedule on ACTIVE loans. */
    activePastDue: number;
    /** Trailing-3-months origination pace. */
    paceLoansPerMonth: number;
  };
  /**
   * The engine has no partial-payment state, so the observed collection rate is
   * translated into `tasaDefault` (see ./collectionRate.ts). These are the ends
   * of that translation, so the CLI can show the honest range.
   */
  defaultRate: {
    /** Every peso currently past due is eventually collected. */
    ifAllPastDueIsCollected: number;
    /** No past-due money ever arrives. */
    ifNoPastDueIsCollected: number;
    /** At the prefilled recovery assumption. */
    atAssumedRecovery: number;
    recoveryAssumption: number;
  };
  /** Engine config prefilled from the facts above. */
  prefill: ProjectionConfig;
};

/** node:sqlite is stable in practice but still flagged experimental on Node 22;
 * import lazily with the warning muted so CLI output stays clean. */
async function loadSqlite(): Promise<typeof import("node:sqlite")> {
  const original = process.emitWarning;
  process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
    const text = typeof warning === "string" ? warning : warning.message;
    if (text.includes("SQLite")) return;
    return (original as (...a: unknown[]) => void).call(process, warning, ...args);
  }) as typeof process.emitWarning;
  try {
    return await import("node:sqlite");
  } finally {
    process.emitWarning = original;
  }
}

function parseDateOnly(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (!m) throw new Error(`Invalid date: ${dateStr}. Use YYYY-MM-DD.`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
}

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Calendar-aligned cohort window start (YYYY-MM) for a date. */
export function cohortStartMonth(start: Date, cohortMonths: number): string {
  const bucket = Math.floor(start.getMonth() / cohortMonths) * cohortMonths;
  return `${start.getFullYear()}-${String(bucket + 1).padStart(2, "0")}`;
}

export function cohortLabel(startMonth: string, cohortMonths: number): string {
  if (cohortMonths === 1) return startMonth;
  const [y, m] = startMonth.split("-").map(Number);
  const endM = Math.min(12, m + cohortMonths - 1);
  return `${startMonth}..${y}-${String(endM).padStart(2, "0")}`;
}

/**
 * Recency-weighted blend: each cohort weighs its data volume (dueToDate)
 * doubled per step toward the present, so the newest cohort dominates.
 */
export function blendCollectionRate(cohorts: ModeloCohort[]): number {
  let wSum = 0;
  let wRate = 0;
  cohorts.forEach((c, i) => {
    const w = c.dueToDate * 2 ** i;
    wSum += w;
    wRate += w * c.collectionRate;
  });
  return wSum > 0 ? wRate / wSum : 0;
}

export async function calibrateFromDb(options: {
  dbPath: string;
  asOf?: string;
  cohortMonths?: number;
  recentCohorts?: number;
}): Promise<ModeloCalibration> {
  const cohortMonths = options.cohortMonths ?? 2;
  const recentCohorts = options.recentCohorts ?? 2;
  const asOf = options.asOf ?? localDateString(new Date());
  const asOfDate = parseDateOnly(asOf);
  const asOfBound = `${asOf} 23:59:59`;

  const { DatabaseSync } = await loadSqlite();
  const db = new DatabaseSync(options.dbPath, { readOnly: true });
  try {
    const loans = db
      .prepare(
        `SELECT l.id, l.status, CAST(l.principal AS REAL) principal,
                l.term_length, CAST(l.payment_amount AS REAL) payment_amount,
                l.payment_frequency,
                COALESCE(date(l.starting_date),
                         (SELECT date(MIN(p.paid_at)) FROM payments p
                          WHERE p.loan_id = l.id AND p.status != 'REVERSED'),
                         date(l.created_at)) AS start
         FROM loans l WHERE l.status != 'CANCELLED'`
      )
      .all() as unknown as {
      id: string;
      status: string;
      principal: number;
      term_length: number;
      payment_amount: number;
      payment_frequency: string;
      start: string | null;
    }[];

    const paid = new Map<string, { installments: number; events: number; lateEvents: number }>();
    for (const r of db
      .prepare(
        `SELECT loan_id,
                SUM(CASE WHEN kind = 'INSTALLMENT' THEN amount ELSE 0 END) inst,
                SUM(CASE WHEN kind = 'INSTALLMENT' THEN 1 ELSE 0 END) events,
                SUM(CASE WHEN kind = 'LATE_FEE' THEN 1 ELSE 0 END) late
         FROM payments WHERE status != 'REVERSED' AND paid_at <= ?
         GROUP BY loan_id`
      )
      .all(asOfBound) as unknown as {
      loan_id: string;
      inst: number | null;
      events: number | null;
      late: number | null;
    }[]) {
      paid.set(r.loan_id, {
        installments: Number(r.inst ?? 0),
        events: Number(r.events ?? 0),
        lateEvents: Number(r.late ?? 0)
      });
    }

    const cohortMap = new Map<string, ModeloCohort & { loanIds: string[] }>();
    let totalPrincipal = 0;
    let defaultedPrincipal = 0;
    let defaultedRecovered = 0;
    let outstandingPrincipal = 0;
    let activePastDue = 0;
    let paceLoans = 0;
    const paceWindowStart = new Date(asOfDate);
    paceWindowStart.setMonth(paceWindowStart.getMonth() - 3);

    for (const l of loans) {
      const start = parseDateOnly(l.start ?? asOf);
      if (start.getTime() > asOfDate.getTime()) continue;
      const intervalDays = l.payment_frequency === "WEEKLY" ? 7 : 14;
      const elapsed = Math.min(
        l.term_length,
        Math.max(0, Math.floor((asOfDate.getTime() - start.getTime()) / (intervalDays * DAY_MS)))
      );
      const dueToDate = elapsed * l.payment_amount;
      const contractValue = l.payment_amount * l.term_length;
      const p = paid.get(l.id) ?? { installments: 0, events: 0, lateEvents: 0 };

      const startMonth = cohortStartMonth(start, cohortMonths);
      let cohort = cohortMap.get(startMonth);
      if (!cohort) {
        cohort = {
          label: cohortLabel(startMonth, cohortMonths),
          startMonth,
          loans: 0,
          principal: 0,
          contractValue: 0,
          dueToDate: 0,
          collected: 0,
          collectionRate: 0,
          defaultedLoans: 0,
          defaultedPrincipal: 0,
          loanIds: []
        };
        cohortMap.set(startMonth, cohort);
      }
      cohort.loans += 1;
      cohort.principal += l.principal;
      cohort.contractValue += contractValue;
      cohort.dueToDate += dueToDate;
      cohort.collected += p.installments;
      cohort.loanIds.push(l.id);
      totalPrincipal += l.principal;
      if (l.status === "DEFAULTED") {
        cohort.defaultedLoans += 1;
        cohort.defaultedPrincipal += l.principal;
        defaultedPrincipal += l.principal;
        defaultedRecovered += p.installments;
      }
      if (l.status === "ACTIVE") {
        const remainingShare =
          contractValue > 0 ? Math.max(0, contractValue - p.installments) / contractValue : 0;
        outstandingPrincipal += l.principal * remainingShare;
        activePastDue += Math.max(0, dueToDate - p.installments);
      }
      if (start.getTime() >= paceWindowStart.getTime()) paceLoans += 1;
    }

    const cohorts = [...cohortMap.values()].sort((a, b) =>
      a.startMonth.localeCompare(b.startMonth)
    );
    for (const c of cohorts) {
      c.collectionRate = c.dueToDate > 0 ? c.collected / c.dueToDate : 0;
    }

    // Recent window: the last N cohorts that have anything due yet.
    const recent = cohorts.filter((c) => c.dueToDate > 0).slice(-recentCohorts);
    const recentIds = new Set(recent.flatMap((c) => c.loanIds));
    const collectionRate = blendCollectionRate(recent);

    let lateEvents = 0;
    let events = 0;
    for (const id of recentIds) {
      const p = paid.get(id);
      if (!p) continue;
      lateEvents += p.lateEvents;
      events += p.events;
    }
    const lateShare = events > 0 ? lateEvents / events : 0;

    const recentLoansRows = loans.filter((l) => recentIds.has(l.id));
    const recentPrincipal = recentLoansRows.reduce((s, l) => s + l.principal, 0);
    const recentContract = recentLoansRows.reduce(
      (s, l) => s + l.payment_amount * l.term_length,
      0
    );
    const weeklyCount = recentLoansRows.filter((l) => l.payment_frequency === "WEEKLY").length;
    const frecuenciaPago: FrecuenciaPago =
      weeklyCount * 2 >= recentLoansRows.length ? "SEMANAL" : "QUINCENAL";
    const avgTerm =
      recentLoansRows.length > 0
        ? recentLoansRows.reduce((s, l) => s + l.term_length, 0) / recentLoansRows.length
        : 10;

    const opexRows = db
      .prepare(
        `SELECT strftime('%Y-%m', occurred_at) month, SUM(amount) amount
         FROM accounting_transactions
         WHERE type = 'EXPENSE' AND status != 'REVERSED' AND occurred_at <= ?
         GROUP BY month`
      )
      .all(asOfBound) as unknown as { month: string; amount: number }[];
    const opexMonthlyAvg =
      opexRows.length > 0
        ? opexRows.reduce((s, r) => s + Number(r.amount), 0) / opexRows.length
        : 0;

    const ledgerCash = Number(
      (
        db
          .prepare(
            `SELECT SUM(CASE WHEN type IN ('DEPOSIT','INCOME') THEN amount
                             WHEN type IN ('EXPENSE','WITHDRAWAL') THEN -amount
                             ELSE 0 END) cash
             FROM accounting_transactions WHERE status != 'REVERSED' AND occurred_at <= ?`
          )
          .get(asOfBound) as { cash: number | null }
      ).cash ?? 0
    );

    const lossRate =
      totalPrincipal > 0 ? (defaultedPrincipal - defaultedRecovered) / totalPrincipal : 0;

    const plazoBase = Math.max(1, Math.round(avgTerm));
    const defaultRate = {
      ifAllPastDueIsCollected: lossRate,
      ifNoPastDueIsCollected: effectiveDefaultRate({
        collectionRate,
        term: plazoBase,
        recovery: 0,
        formalLossRate: lossRate
      }),
      atAssumedRecovery: effectiveDefaultRate({
        collectionRate,
        term: plazoBase,
        recovery: DEFAULT_RECOVERY_ASSUMPTION,
        formalLossRate: lossRate
      }),
      recoveryAssumption: DEFAULT_RECOVERY_ASSUMPTION
    };

    const prefill: ProjectionConfig = {
      // Street money is not spendable today, and at the observed collection
      // rate not all of it comes back — discount it rather than treating the
      // whole book as free capital.
      inversionInicial: Math.round(Math.max(0, ledgerCash) + outstandingPrincipal * collectionRate),
      gastosFijosMensuales: Math.round(opexMonthlyAvg),
      inversionMensual: 0,
      prestamoPromedio:
        recentLoansRows.length > 0 ? Math.round(recentPrincipal / recentLoansRows.length) : 5000,
      tasaInteres:
        recentPrincipal > 0 ? Math.round((recentContract / recentPrincipal - 1) * 100) / 100 : 0.3,
      frecuenciaPago,
      plazoBase,
      prestamosPorSemana: Math.max(1, Math.round(paceLoans / 3 / 4.33)),
      tasaMorosidad: Math.round(lateShare * 100) / 100,
      tasaDefault: Math.round(defaultRate.atAssumedRecovery * 100) / 100,
      horizonteMeses: 24
    };

    return {
      asOf,
      dbPath: options.dbPath,
      cohortMonths,
      recentCohorts,
      // loanIds is internal bookkeeping for the recent-cohort window.
      cohorts: cohorts.map((c) => {
        const copy: ModeloCohort & { loanIds?: string[] } = { ...c };
        delete copy.loanIds;
        return copy;
      }),
      facts: {
        collectionRate,
        lossRate,
        lateShare,
        opexMonthlyAvg,
        ledgerCash,
        outstandingPrincipal,
        activePastDue,
        paceLoansPerMonth: paceLoans / 3
      },
      defaultRate,
      prefill
    };
  } finally {
    db.close();
  }
}
