/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The projection engine now lives in `@mikro/common/projection` (browser-safe
 * subpath) so the Modelo page and the modelo report PDF share one source. This
 * re-export keeps existing local imports (`../lib/projection`) working.
 */
export {
  runProjection,
  calculateLoanTerms,
  calculateMinLoansForBreakeven,
  frequencyToWeeks,
  WEEKS_PER_MONTH,
  type FrecuenciaPago,
  type ProjectionConfig,
  type LoanTerms,
  type WeekSnapshot,
  type MonthSummary,
  type SensitivityScenario,
  type ProjectionResult
} from "@mikro/common/projection";
