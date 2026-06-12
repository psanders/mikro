/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Browser-safe projection engine for the business-model ("Modelo") screen and
 * the modelo report PDF. Imported via `@mikro/common/projection` (not the
 * barrel) so the dashboard bundle stays free of server-only modules.
 */
export {
  runProjection,
  calculateLoanTerms,
  calculateMinLoansForBreakeven,
  frequencyToWeeks,
  WEEKS_PER_MONTH
} from "./engine.js";
export type {
  FrecuenciaPago,
  ProjectionConfig,
  LoanTerms,
  WeekSnapshot,
  MonthSummary,
  SensitivityScenario,
  ProjectionResult
} from "./engine.js";
