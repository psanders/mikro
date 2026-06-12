/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Server-only contract PDF rendering. Imported via `@mikro/common/contracts`
 * (not the barrel) so the pdfkit dependency stays out of the dashboard bundle.
 */
export { renderContractPdf } from "./generator.js";
export { renderSummaryPdf } from "./summaryGenerator.js";
export type { ContractData, ContractFrequency } from "./types.js";
export type {
  SolicitudSummaryData,
  SummaryScoreCategory,
  SummaryScoreIndicators,
  SummaryEvaluatorNote
} from "./summaryGenerator.js";
