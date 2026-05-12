/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
export { withErrorHandlingAndValidation } from "./withErrorHandlingAndValidation.js";
export { validatePhone } from "./validatePhone.js";
export {
  getCycleMetrics,
  getDueDateForCycle,
  getLateDaysThreshold,
  dayOfWeekToNumber,
  daysToFirstPreferredDay,
  MS_PER_DAY,
  type LoanPaymentData,
  type CycleMetrics
} from "./calculatePaymentStatus.js";
export {
  getMissedPaymentsCount,
  getTimesLateInLookback,
  getTimesLateInLastWeeks,
  getLatenessTrend,
  getPaymentRating,
  getReportRowHighlight,
  formatPaymentFrequency,
  type LatenessTrend,
  type ReportRowHighlight
} from "./customerReportHelpers.js";
export {
  LOOKBACK_WEEKS_FOR_LATENESS,
  TREND_LOOKBACK_WEEKS,
  LATE_DAYS_THRESHOLD,
  HIGHLIGHT_YELLOW_MIN_MISSED,
  HIGHLIGHT_YELLOW_TIMES_LATE_IN_LOOKBACK,
  HIGHLIGHT_RED_MIN_MISSED,
  HIGHLIGHT_RED_DETERIORATING_MIN_MISSED
} from "./customerReportConstants.js";
export {
  buildGroupedCustomerRows,
  type CustomerForGrouping,
  type LoanForGrouping,
  type GroupedCustomerRow,
  type GroupedCustomerRows
} from "./customerReportGrouping.js";
export {
  getRemainingInstallments,
  getNearCompletionThreshold,
  isNearCompletion,
  getRenewalCandidateMetrics,
  type LoanPaymentDataWithTerm,
  type RenewalCandidateMetrics
} from "./renewalReportHelpers.js";
export {
  DEFAULT_ADJUSTMENT_PER_PERIOD,
  DEFAULT_MIN_RATE,
  DEFAULT_MAX_RATE,
  DEFAULT_OPTIONS_RANGE,
  DEFAULT_PAYMENT_ROUNDING_INCREMENT
} from "./loanCalculatorConstants.js";
export { formatMoney, type FormatMoneyInput } from "./formatMoney.js";
export {
  computeAccruedMora,
  daysLateFromOldestDue,
  type ComputeAccruedMoraInput,
  type ComputeAccruedMoraResult
} from "./lateFee.js";
export {
  amountToNumber,
  toLoanPaymentData,
  type LoanWithPaymentsForMora
} from "./loanMoraHelpers.js";
