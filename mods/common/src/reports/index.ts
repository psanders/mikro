/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

export type { PortfolioMetrics, LoansByStatus, LoansBySize, ReportNarrative } from "./types.js";
export { buildReportNarrativePrompt, parseReportNarrativeResponse } from "./reportPrompt.js";
export {
  createPerformanceReportLayout,
  REPORT_WIDTH,
  REPORT_HEIGHT
} from "./performanceReportLayout.js";
export { renderPerformanceReportToPng, loadLogoDataUrl } from "./reportGenerator.js";
export {
  createCustomersReportLayout,
  getCustomersReportHeight,
  CUSTOMERS_REPORT_WIDTH
} from "./customersReportLayout.js";
export { renderCustomersReportToPng } from "./customersReportGenerator.js";
export {
  buildLoanNotesSummaryPrompt,
  parseLoanNotesSummaryResponse,
  type NoteForSummary
} from "./defaultedReportPrompt.js";
export {
  createDefaultedReportLayout,
  getDefaultedReportHeight,
  DEFAULTED_REPORT_WIDTH,
  type DefaultedReportRow
} from "./defaultedReportLayout.js";
export { renderDefaultedReportToPng } from "./defaultedReportGenerator.js";
export {
  buildRenewalCandidateNotePrompt,
  parseRenewalCandidateNoteResponse,
  type RenewalCandidateContext
} from "./renewalReportPrompt.js";
export {
  createRenewalReportLayout,
  getRenewalReportHeight,
  RENEWAL_REPORT_WIDTH,
  type RenewalReportRow
} from "./renewalReportLayout.js";
export { renderRenewalReportToPng } from "./renewalReportGenerator.js";
