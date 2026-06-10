/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Infers business-model parameters from live data so the Modelo screen
 * prefills with the operation's real numbers instead of asking for everything
 * (the original skill asked all 11 questions manually). Every inferred value
 * stays editable in the form; `source` says where each number came from.
 */
import type { FrecuenciaPago, ProjectionConfig } from "./projection";

// Skill defaults for what we cannot infer (or have too little data for).
export const SKILL_DEFAULTS: ProjectionConfig = {
  inversionInicial: 100000,
  gastosFijosMensuales: 15000,
  inversionMensual: 0,
  prestamoPromedio: 5000,
  tasaInteres: 0.3,
  frecuenciaPago: "SEMANAL",
  plazoBase: 10,
  prestamosPorSemana: 3,
  tasaMorosidad: 0.15,
  tasaDefault: 0.05,
  horizonteMeses: 12
};

export interface LoanLike {
  principal: number;
  termLength: number;
  paymentAmount: number;
  paymentFrequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  status: "ACTIVE" | "COMPLETED" | "DEFAULTED" | "CANCELLED";
  startingDate: Date | string | null;
  createdAt: Date | string;
}

export interface AccountLike {
  currentBalance: number;
}

/** Per-field provenance, shown as a hint chip next to inferred inputs. */
export type FieldSource = "datos" | "manual";

export interface InferredDefaults {
  config: ProjectionConfig;
  sources: Record<keyof ProjectionConfig, FieldSource>;
  /** Sample sizes, for the "basado en N préstamos" hint. */
  loanSample: number;
  terminalSample: number;
}

const FREQ_MAP: Record<LoanLike["paymentFrequency"], FrecuenciaPago> = {
  DAILY: "DIARIO",
  WEEKLY: "SEMANAL",
  BIWEEKLY: "QUINCENAL",
  MONTHLY: "MENSUAL"
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mode<T>(values: T[]): T {
  const counts = new Map<T, number>();
  let best = values[0];
  let bestCount = 0;
  for (const v of values) {
    const c = (counts.get(v) ?? 0) + 1;
    counts.set(v, c);
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

/**
 * Builds prefill values from live data. Pass whatever loaded; missing pieces
 * fall back to the skill defaults and are marked "manual".
 *
 * DEVELOPER NOTES on inference quality:
 * - `tasaInteres` is implied from paymentAmount × termLength ÷ principal − 1,
 *   which includes the RD$50 round-up — slightly above the contractual rate.
 * - `tasaDefault` uses terminal loans only (DEFAULTED ÷ (DEFAULTED+COMPLETED));
 *   with fewer than 10 terminal loans we keep the skill default of 5%.
 * - `tasaMorosidad` is NOT inferable from the loan list alone (needs per-loan
 *   payment-cycle status). A dedicated apiserver procedure that runs
 *   computeAccruedMora over active loans could supply it later; until then
 *   the skill default of 15% applies.
 * - `prestamosPorSemana` averages placements over the last 8 weeks.
 * - `listLoans` caps at 100 rows; inference uses that sample. Fine at current
 *   scale, revisit if the portfolio grows past it.
 */
export function inferDefaults(input: {
  loans?: LoanLike[];
  accounts?: AccountLike[];
  /** Total EXPENSE amount over the lookback window, plus the window in months. */
  expenses?: { total: number; months: number };
}): InferredDefaults {
  const config = { ...SKILL_DEFAULTS };
  const sources = Object.fromEntries(
    Object.keys(SKILL_DEFAULTS).map((k) => [k, "manual"])
  ) as Record<keyof ProjectionConfig, FieldSource>;

  const loans = input.loans ?? [];
  const lendable = loans.filter((l) => l.status !== "CANCELLED");

  if (lendable.length > 0) {
    config.prestamoPromedio = Math.round(median(lendable.map((l) => l.principal)));
    config.plazoBase = mode(lendable.map((l) => l.termLength));
    config.frecuenciaPago = FREQ_MAP[mode(lendable.map((l) => l.paymentFrequency))];
    sources.prestamoPromedio = "datos";
    sources.plazoBase = "datos";
    sources.frecuenciaPago = "datos";

    const impliedRates = lendable
      .filter((l) => l.principal > 0)
      .map((l) => (l.paymentAmount * l.termLength) / l.principal - 1)
      .filter((r) => r > 0 && r <= 1);
    if (impliedRates.length > 0) {
      config.tasaInteres = Math.round(median(impliedRates) * 100) / 100;
      sources.tasaInteres = "datos";
    }

    const now = Date.now();
    const eightWeeksMs = 56 * 24 * 60 * 60 * 1000;
    const recent = lendable.filter((l) => {
      const placed = new Date(l.startingDate ?? l.createdAt).getTime();
      return now - placed <= eightWeeksMs;
    });
    if (recent.length > 0) {
      config.prestamosPorSemana = Math.max(1, Math.round(recent.length / 8));
      sources.prestamosPorSemana = "datos";
    }

    const terminal = lendable.filter((l) => l.status === "COMPLETED" || l.status === "DEFAULTED");
    if (terminal.length >= 10) {
      const defaulted = terminal.filter((l) => l.status === "DEFAULTED").length;
      config.tasaDefault = Math.round((defaulted / terminal.length) * 100) / 100;
      sources.tasaDefault = "datos";
    }
  }

  if (input.accounts && input.accounts.length > 0) {
    config.inversionInicial = Math.max(
      0,
      Math.round(input.accounts.reduce((sum, a) => sum + a.currentBalance, 0))
    );
    sources.inversionInicial = "datos";
  }

  if (input.expenses && input.expenses.months > 0 && input.expenses.total > 0) {
    config.gastosFijosMensuales = Math.round(input.expenses.total / input.expenses.months);
    sources.gastosFijosMensuales = "datos";
  }

  return {
    config,
    sources,
    loanSample: lendable.length,
    terminalSample: lendable.filter((l) => l.status === "COMPLETED" || l.status === "DEFAULTED")
      .length
  };
}
