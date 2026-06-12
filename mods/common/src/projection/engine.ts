/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Break-even projection engine for the business-model screen ("Modelo").
 *
 * Port of skills/mikro-modelo-negocio.skill → scripts/generate_projection.py.
 * The financial formulas (loan terms, mora, rounding, min-loans steady-state
 * math, sensitivity scenarios) are kept identical to the skill; do not change
 * them without explicit instruction.
 *
 * Browser-safe: pure arithmetic, no `fs`/Node bindings. Lives in @mikro/common
 * behind the `./projection` subpath so the dashboard (Modelo page) and the
 * server (modelo report PDF) compute the identical result from one source.
 *
 * DEVELOPER NOTE — randomness: the Python engine seeds `random.seed(loanId *
 * 1000 + week)` (Mersenne Twister) per payment event. We keep the same seeding
 * scheme and draw order (default roll, then delinquency roll) but use
 * mulberry32, so individual draws differ from the Python script. Results are
 * deterministic for a given config and statistically equivalent; break-even
 * week may differ by ±1–2 weeks vs the PDF skill on the same inputs.
 */
import {
  DEFAULT_MIN_RATE,
  DEFAULT_MAX_RATE,
  DEFAULT_PAYMENT_ROUNDING_INCREMENT
} from "../utils/loanCalculatorConstants.js";

// Mirrors the skill's hardcoded "derived constants from the Mikro codebase".
const DEFAULT_MORA_RATE = 0.1; // 10% of cuota per 30 days late
const MORA_CAP_IN_CUOTAS = 1; // cap mora at 1x cuota
export const WEEKS_PER_MONTH = 4.33;

export type FrecuenciaPago = "DIARIO" | "SEMANAL" | "QUINCENAL" | "MENSUAL";

export interface ProjectionConfig {
  /** Capital total disponible para prestar al inicio (RD$). */
  inversionInicial: number;
  /** Renta, salario cobrador, transporte, telecom, etc. (RD$/mes). */
  gastosFijosMensuales: number;
  /** Capital fresco inyectado cada mes (RD$); 0 = solo reinvierte. */
  inversionMensual: number;
  /** Principal promedio por préstamo (RD$). */
  prestamoPromedio: number;
  /** Tasa de interés total sobre el principal (0–1, e.g. 0.30). */
  tasaInteres: number;
  frecuenciaPago: FrecuenciaPago;
  /** Número de cuotas. */
  plazoBase: number;
  prestamosPorSemana: number;
  /** Porcentaje de préstamos que caen en mora (0–1). */
  tasaMorosidad: number;
  /** Porcentaje de préstamos que nunca se pagan (0–1). */
  tasaDefault: number;
  horizonteMeses: number;
}

export interface LoanTerms {
  principal: number;
  interestRate: number;
  totalInterest: number;
  totalRepay: number;
  paymentPerPeriod: number;
  actualTotal: number;
  termLength: number;
  profitPerLoan: number;
}

export interface WeekSnapshot {
  week: number;
  month: number;
  capitalAvailable: number;
  capitalDeployed: number;
  freshInjection: number;
  newLoans: number;
  activeLoans: number;
  completedLoans: number;
  defaultedLoans: number;
  installmentCollections: number;
  moraIncome: number;
  totalRevenue: number;
  fixedCosts: number;
  defaultLosses: number;
  totalCosts: number;
  netWeekly: number;
  cumulativeProfit: number;
  cumulativeInvested: number;
  roiPct: number;
}

export interface MonthSummary {
  month: number;
  newLoans: number;
  capitalDeployed: number;
  installmentCollections: number;
  moraIncome: number;
  defaultLosses: number;
  fixedCosts: number;
  netProfit: number;
  freshInjection: number;
  activeLoansEnd: number;
  cumulativeProfit: number;
}

export interface SensitivityScenario {
  label: string;
  description: string;
  breakEvenWeek?: number | null;
  breakEvenMonth?: number | null;
  matureMonthlyProfit?: number;
  minLoansNeeded?: number;
}

export interface ProjectionResult {
  config: ProjectionConfig;
  summary: {
    breakEvenWeek: number | null;
    breakEvenMonth: number | null;
    totalLoansPlaced: number;
    roiAtHorizonPct: number;
    cumulativeProfitAtHorizon: number;
    matureMonthlyProfit: number;
    totalInvested: number;
    minLoansPerWeekForBreakeven: number;
    loanTerms: LoanTerms;
  };
  weeklySnapshots: WeekSnapshot[];
  monthlySummaries: MonthSummary[];
  sensitivity: SensitivityScenario[];
}

/** Deterministic PRNG (mulberry32); stands in for Python's seeded MT19937. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundUpToIncrement(value: number, increment = DEFAULT_PAYMENT_ROUNDING_INCREMENT) {
  return Math.ceil(value / increment) * increment;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Same math as @mikro/common calculateLoanOptions for the base duration. */
export function calculateLoanTerms(
  principal: number,
  interestRate: number,
  termLength: number
): LoanTerms {
  const rate = Math.min(DEFAULT_MAX_RATE, Math.max(DEFAULT_MIN_RATE, interestRate));
  const totalInterest = round2(principal * rate);
  const totalRepay = round2(principal + totalInterest);
  const paymentPerPeriod = roundUpToIncrement(totalRepay / termLength);
  const actualTotal = paymentPerPeriod * termLength;
  return {
    principal,
    interestRate: rate,
    totalInterest,
    totalRepay,
    paymentPerPeriod,
    actualTotal,
    termLength,
    profitPerLoan: actualTotal - principal
  };
}

// DEVELOPER NOTE: the simulation advances in whole weeks (like the Python
// skill), so DIARIO loans are modeled as one consolidated payment per week.
// Steady-state min-loans math does use the true 1/7 spacing.
export function frequencyToWeeks(frecuencia: FrecuenciaPago): number {
  switch (frecuencia) {
    case "DIARIO":
      return 1 / 7;
    case "QUINCENAL":
      return 2;
    case "MENSUAL":
      return WEEKS_PER_MONTH;
    default:
      return 1;
  }
}

interface SimLoan {
  id: number;
  payments: number;
  term: number;
  weeksSince: number;
  defaulted: boolean;
  payment: number;
  principal: number;
  weeksBetween: number;
}

/** Full week-by-week projection (port of run_projection). */
export function runProjection(config: ProjectionConfig): ProjectionResult {
  return { ...runProjectionCore(config), sensitivity: runSensitivity(config) };
}

/** Simulation without sensitivity scenarios (which re-run the sim themselves). */
function runProjectionCore(config: ProjectionConfig): Omit<ProjectionResult, "sensitivity"> {
  const loanTerms = calculateLoanTerms(
    config.prestamoPromedio,
    config.tasaInteres,
    config.plazoBase
  );
  const weeksBetween = frequencyToWeeks(config.frecuenciaPago);
  const totalWeeks = Math.floor(config.horizonteMeses * WEEKS_PER_MONTH);
  const weeklyFixedCost = config.gastosFijosMensuales / WEEKS_PER_MONTH;

  let capitalAvailable = config.inversionInicial;
  let cumulativeProfit = 0;
  let cumulativeInvested = config.inversionInicial;
  let loanCounter = 0;
  let breakEvenWeek: number | null = null;
  const activeLoans: SimLoan[] = [];

  const weeklySnapshots: WeekSnapshot[] = [];
  const monthlySummaries: MonthSummary[] = [];

  const emptyMonth = (month: number): MonthSummary => ({
    month,
    newLoans: 0,
    capitalDeployed: 0,
    installmentCollections: 0,
    moraIncome: 0,
    defaultLosses: 0,
    fixedCosts: 0,
    netProfit: 0,
    freshInjection: 0,
    activeLoansEnd: 0,
    cumulativeProfit: 0
  });
  let monthData = emptyMonth(1);

  for (let week = 1; week <= totalWeeks; week++) {
    const currentMonth = Math.ceil(week / WEEKS_PER_MONTH);

    if (currentMonth !== monthData.month) {
      monthData.activeLoansEnd = activeLoans.filter((l) => !l.defaulted).length;
      monthlySummaries.push({ ...monthData });
      monthData = emptyMonth(currentMonth);
    }

    const snapshot: Partial<WeekSnapshot> & { week: number; month: number } = {
      week,
      month: currentMonth,
      freshInjection: 0
    };

    // Monthly injection on the first week of each month after month 1.
    if (config.inversionMensual > 0 && currentMonth > 1) {
      const firstWeekOfMonth = Math.floor((currentMonth - 1) * WEEKS_PER_MONTH) + 1;
      if (week === firstWeekOfMonth) {
        capitalAvailable += config.inversionMensual;
        cumulativeInvested += config.inversionMensual;
        snapshot.freshInjection = config.inversionMensual;
        monthData.freshInjection += config.inversionMensual;
      }
    }

    // Place new loans while capital allows.
    let loansPlaced = 0;
    for (let i = 0; i < config.prestamosPorSemana; i++) {
      if (capitalAvailable >= config.prestamoPromedio) {
        loanCounter += 1;
        activeLoans.push({
          id: loanCounter,
          payments: 0,
          term: config.plazoBase,
          weeksSince: 0,
          defaulted: false,
          payment: loanTerms.paymentPerPeriod,
          principal: config.prestamoPromedio,
          weeksBetween
        });
        capitalAvailable -= config.prestamoPromedio;
        loansPlaced += 1;
      }
    }
    monthData.newLoans += loansPlaced;
    monthData.capitalDeployed += loansPlaced * config.prestamoPromedio;

    // Process active loans.
    let weekInstallments = 0;
    let weekMora = 0;
    let weekDefaults = 0;
    let completedThisWeek = 0;
    let defaultedThisWeek = 0;

    for (const loan of activeLoans) {
      if (loan.defaulted) continue;
      loan.weeksSince += 1;
      if (loan.weeksSince < loan.weeksBetween) continue;

      const rand = mulberry32(loan.id * 1000 + week);

      // Default first (permanent loss of remaining principal).
      if (rand() < config.tasaDefault / loan.term) {
        loan.defaulted = true;
        defaultedThisWeek += 1;
        weekDefaults += loan.principal * (1 - loan.payments / loan.term);
        continue;
      }

      // Delinquency → payment arrives late, plus mora.
      if (rand() < config.tasaMorosidad) {
        const daysLate = loan.weeksBetween * 7;
        let mora = DEFAULT_MORA_RATE * (daysLate / 30) * loan.payment;
        mora = Math.min(mora, loan.payment * MORA_CAP_IN_CUOTAS);
        weekMora += mora;
      }
      weekInstallments += loan.payment;
      loan.payments += 1;
      loan.weeksSince = 0;

      if (loan.payments >= loan.term) completedThisWeek += 1;
    }

    // Drop completed loans; their principal is already back in circulation.
    for (let i = activeLoans.length - 1; i >= 0; i--) {
      const l = activeLoans[i];
      if (!l.defaulted && l.payments >= l.term) activeLoans.splice(i, 1);
    }

    capitalAvailable += weekInstallments + weekMora;

    const activeCount = activeLoans.filter((l) => !l.defaulted).length;
    const totalRevenue = weekInstallments + weekMora;
    const totalCosts = weeklyFixedCost + weekDefaults;
    const netWeekly = totalRevenue - totalCosts;
    cumulativeProfit += netWeekly;

    snapshot.capitalAvailable = round2(capitalAvailable);
    snapshot.capitalDeployed = round2(
      activeLoans
        .filter((l) => !l.defaulted)
        .reduce((sum, l) => sum + l.principal * (1 - l.payments / l.term), 0)
    );
    snapshot.newLoans = loansPlaced;
    snapshot.activeLoans = activeCount;
    snapshot.completedLoans = completedThisWeek;
    snapshot.defaultedLoans = defaultedThisWeek;
    snapshot.installmentCollections = round2(weekInstallments);
    snapshot.moraIncome = round2(weekMora);
    snapshot.totalRevenue = round2(totalRevenue);
    snapshot.fixedCosts = round2(weeklyFixedCost);
    snapshot.defaultLosses = round2(weekDefaults);
    snapshot.totalCosts = round2(totalCosts);
    snapshot.netWeekly = round2(netWeekly);
    snapshot.cumulativeProfit = round2(cumulativeProfit);
    snapshot.cumulativeInvested = round2(cumulativeInvested);
    snapshot.roiPct =
      cumulativeInvested > 0 ? round2((cumulativeProfit / cumulativeInvested) * 100) : 0;

    if (breakEvenWeek === null && cumulativeProfit >= 0) breakEvenWeek = week;

    weeklySnapshots.push(snapshot as WeekSnapshot);

    monthData.installmentCollections += weekInstallments;
    monthData.moraIncome += weekMora;
    monthData.defaultLosses += weekDefaults;
    monthData.fixedCosts += weeklyFixedCost;
    monthData.netProfit += netWeekly;
    monthData.cumulativeProfit = cumulativeProfit;
  }

  monthData.activeLoansEnd = activeLoans.filter((l) => !l.defaulted).length;
  monthlySummaries.push({ ...monthData });
  for (const m of monthlySummaries) {
    m.capitalDeployed = round2(m.capitalDeployed);
    m.installmentCollections = round2(m.installmentCollections);
    m.moraIncome = round2(m.moraIncome);
    m.defaultLosses = round2(m.defaultLosses);
    m.fixedCosts = round2(m.fixedCosts);
    m.netProfit = round2(m.netProfit);
    m.freshInjection = round2(m.freshInjection);
    m.cumulativeProfit = round2(m.cumulativeProfit);
  }

  const lastWeek = weeklySnapshots[weeklySnapshots.length - 1];
  const last3 = monthlySummaries.slice(-3);
  const matureMonthlyProfit =
    monthlySummaries.length >= 3 ? last3.reduce((s, m) => s + m.netProfit, 0) / 3 : 0;

  return {
    config,
    summary: {
      breakEvenWeek,
      breakEvenMonth: breakEvenWeek !== null ? Math.ceil(breakEvenWeek / WEEKS_PER_MONTH) : null,
      totalLoansPlaced: loanCounter,
      roiAtHorizonPct: lastWeek?.roiPct ?? 0,
      cumulativeProfitAtHorizon: lastWeek?.cumulativeProfit ?? 0,
      matureMonthlyProfit: round2(matureMonthlyProfit),
      totalInvested: round2(cumulativeInvested),
      minLoansPerWeekForBreakeven: calculateMinLoansForBreakeven(config, loanTerms),
      loanTerms
    },
    weeklySnapshots,
    monthlySummaries
  };
}

/**
 * Minimum NEW loans per week to cover fixed costs at steady state
 * (port of calculate_min_loans_for_breakeven; same approximations).
 */
export function calculateMinLoansForBreakeven(
  config: ProjectionConfig,
  loanTerms: LoanTerms
): number {
  const weeklyFixed = config.gastosFijosMensuales / WEEKS_PER_MONTH;
  const term = loanTerms.termLength;
  const payment = loanTerms.paymentPerPeriod;
  const principal = config.prestamoPromedio;
  const weeksBetween = frequencyToWeeks(config.frecuenciaPago);

  const interestPerPayment = payment - principal / term;
  let moraPerEvent = DEFAULT_MORA_RATE * ((weeksBetween * 7) / 30) * payment;
  moraPerEvent = Math.min(moraPerEvent, payment * MORA_CAP_IN_CUOTAS);

  const paymentsPerWeek = term / weeksBetween;
  const weeklyInterest = paymentsPerWeek * interestPerPayment * (1 - config.tasaDefault);
  const weeklyMora =
    paymentsPerWeek * moraPerEvent * config.tasaMorosidad * (1 - config.tasaDefault);
  // Average defaulted loan has ~50% of principal outstanding.
  const weeklyDefaultLoss = (1 / weeksBetween) * principal * config.tasaDefault * 0.5;

  const netPerCommitment = weeklyInterest + weeklyMora - weeklyDefaultLoss;
  if (netPerCommitment <= 0) return 999; // not viable
  return Math.ceil(weeklyFixed / netPerCommitment);
}

/** Quick projection for sensitivity rows (no weekly detail). */
function quickProjection(config: ProjectionConfig): {
  breakEvenWeek: number | null;
  matureMonthlyProfit: number;
} {
  const result = runProjectionCore({ ...config });
  return {
    breakEvenWeek: result.summary.breakEvenWeek,
    matureMonthlyProfit: result.summary.matureMonthlyProfit
  };
}

function runSensitivity(config: ProjectionConfig): SensitivityScenario[] {
  const scenarios: SensitivityScenario[] = [];
  const fmtPct = (v: number) => `${Math.round(v * 100)}%`;

  const doubledDefault = Math.min(config.tasaDefault * 2, 0.3);
  scenarios.push({
    label: `Default: ${fmtPct(doubledDefault)}`,
    description: "Tasa de pérdida total duplicada",
    minLoansNeeded: calculateMinLoansForBreakeven(
      { ...config, tasaDefault: doubledDefault },
      calculateLoanTerms(config.prestamoPromedio, config.tasaInteres, config.plazoBase)
    )
  });

  const fewerLoans = Math.max(1, config.prestamosPorSemana - 1);
  const fewer = quickProjection({ ...config, prestamosPorSemana: fewerLoans });
  scenarios.push({
    label: `${fewerLoans} préstamos/semana`,
    description: "Un préstamo menos por semana",
    breakEvenWeek: fewer.breakEvenWeek,
    breakEvenMonth:
      fewer.breakEvenWeek !== null ? Math.ceil(fewer.breakEvenWeek / WEEKS_PER_MONTH) : null,
    matureMonthlyProfit: fewer.matureMonthlyProfit
  });

  if (config.inversionMensual > 0) {
    const noInject = quickProjection({ ...config, inversionMensual: 0 });
    scenarios.push({
      label: "Sin inversión mensual",
      description: "Solo reinvierte ganancias",
      breakEvenWeek: noInject.breakEvenWeek,
      breakEvenMonth:
        noInject.breakEvenWeek !== null
          ? Math.ceil(noInject.breakEvenWeek / WEEKS_PER_MONTH)
          : null,
      matureMonthlyProfit: noInject.matureMonthlyProfit
    });
  }

  const higherRate = Math.min(config.tasaInteres + 0.1, DEFAULT_MAX_RATE);
  const higher = quickProjection({ ...config, tasaInteres: higherRate });
  scenarios.push({
    label: `Interés: ${fmtPct(higherRate)}`,
    description: "Tasa de interés +10 puntos porcentuales",
    breakEvenWeek: higher.breakEvenWeek,
    breakEvenMonth:
      higher.breakEvenWeek !== null ? Math.ceil(higher.breakEvenWeek / WEEKS_PER_MONTH) : null,
    matureMonthlyProfit: higher.matureMonthlyProfit
  });

  return scenarios;
}
