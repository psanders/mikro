/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Corrected profit-and-loss over a ProjectionResult.
 *
 * WHY THIS EXISTS — the projection engine's own `netWeekly` / `cumulativeProfit`
 * count the whole cuota as revenue (engine.ts: `totalRevenue = weekInstallments
 * + weekMora`) while never charging the principal that was disbursed. Most of
 * every cuota is the loan's own principal coming home, so that figure is gross
 * collections, not earnings, and it makes any book look profitable the moment
 * money starts circulating. The engine itself disagrees with it:
 * `calculateMinLoansForBreakeven` prices a loan on interest only.
 *
 * Only the principal share is stripped out here; the engine's simulation
 * mechanics (loan placement, capital recycling, default timing, mora) are used
 * exactly as-is. `engine.ts` is shared with the dashboard Modelo screen and the
 * modelo PDF and is deliberately left untouched.
 */
import type { LoanTerms, ProjectionResult } from "../projection/engine.js";

export type MonthlyPnl = {
  month: number;
  /** Cuotas collected, principal included (what the engine calls revenue). */
  collections: number;
  /** The part of `collections` that is the loan's own principal returning. */
  principalReturned: number;
  /** Interest actually earned on those collections. */
  interestEarned: number;
  moraIncome: number;
  fixedCosts: number;
  defaultLosses: number;
  /** interestEarned + moraIncome − fixedCosts − defaultLosses. */
  net: number;
  cumulativeNet: number;
};

export type PnlSummary = {
  months: MonthlyPnl[];
  /** First month whose own result is positive (operations pay for themselves). */
  operatingBreakevenMonth: number | null;
  /** First month where cumulative earnings turn positive (losses paid back). */
  paybackMonth: number | null;
  cumulativeNet: number;
  /** Mean monthly result over the last three months of the horizon. */
  matureMonthlyNet: number;
  /** Interest earned per peso of cuota collected. */
  interestShare: number;
};

export function computePnl(result: ProjectionResult, loanTerms?: LoanTerms): PnlSummary {
  const terms = loanTerms ?? result.summary.loanTerms;
  const interestShare = terms.actualTotal > 0 ? terms.profitPerLoan / terms.actualTotal : 0;

  let cumulativeNet = 0;
  let operatingBreakevenMonth: number | null = null;
  let paybackMonth: number | null = null;

  const months: MonthlyPnl[] = result.monthlySummaries.map((m) => {
    const collections = m.installmentCollections;
    const interestEarned = collections * interestShare;
    const net = interestEarned + m.moraIncome - m.fixedCosts - m.defaultLosses;
    cumulativeNet += net;
    if (operatingBreakevenMonth === null && net > 0) operatingBreakevenMonth = m.month;
    if (paybackMonth === null && cumulativeNet > 0) paybackMonth = m.month;
    return {
      month: m.month,
      collections,
      principalReturned: collections - interestEarned,
      interestEarned,
      moraIncome: m.moraIncome,
      fixedCosts: m.fixedCosts,
      defaultLosses: m.defaultLosses,
      net,
      cumulativeNet
    };
  });

  const last3 = months.slice(-3);
  const matureMonthlyNet =
    last3.length > 0 ? last3.reduce((s, m) => s + m.net, 0) / last3.length : 0;

  return {
    months,
    operatingBreakevenMonth,
    paybackMonth,
    cumulativeNet,
    matureMonthlyNet,
    interestShare
  };
}
