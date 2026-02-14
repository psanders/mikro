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
export { renderPerformanceReportToPng } from "./reportGenerator.js";
