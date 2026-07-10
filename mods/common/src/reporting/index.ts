/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Reporting foundation — the shared Report contract, the branded multi-page PDF
 * renderer (on the receipts satori→SVG→PNG pipeline), reusable layout blocks,
 * and the FIFO waterfall-allocation + repayment-schedule helpers. Receipts are
 * a separate, PNG-producing capability and are intentionally untouched.
 */
export {
  allocatePaymentsToCuotas,
  allocationInputSchema,
  allocationPaymentSchema,
  type AllocationInput,
  type AllocationPayment,
  type CuotaAllocation
} from "./allocation.js";

export {
  buildRepaymentSchedule,
  type RepaymentScheduleRow,
  type ScheduleRowStatus
} from "./schedule.js";

export { defineReport, type Report, type ReportSpec } from "./report.js";

export {
  renderReportToPdf,
  type ReportDocument,
  type ReportPage,
  type RenderReportDeps
} from "./renderer.js";

export {
  BRAND,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  brandHeader,
  verificationBanner,
  kpiGrid,
  dataTable,
  section,
  footerNote,
  page,
  type ReportElement,
  type KpiCell,
  type TableColumn,
  type TableRow
} from "./blocks.js";

export {
  loanStatementReport,
  loanStatementInputSchema,
  buildLoanStatementData,
  buildLoanStatementDocument,
  type LoanStatementInput,
  type LoanStatementData,
  type LoanStatementKpis,
  type LoanStatementReceivedPayment
} from "./loanStatement.js";

export { formatDop, formatPct, formatDateEs } from "./format.js";

export {
  performanceReport,
  performanceReportInputSchema,
  buildPerformanceReportData,
  buildPerformanceReportDocument,
  type PerformanceReportInput,
  type PerformanceReportData,
  type PerformanceReportKpis,
  type PerformanceReportStatusRow,
  type PerformanceReportSizeRow,
  type PerformanceLoanStatus,
  type PerformanceLoanSize
} from "./performanceReport.js";

export {
  customersReport,
  customersReportInputSchema,
  buildCustomersReportData,
  buildCustomersReportDocument,
  type CustomersReportInput,
  type CustomersReportData,
  type CustomerReportRow,
  type CustomerHealth
} from "./customersReport.js";

export {
  defaultedReport,
  defaultedReportInputSchema,
  defaultedReportRowInputSchema,
  buildDefaultedReportData,
  buildDefaultedReportDocument,
  type DefaultedReportInput,
  type DefaultedReportRowInput,
  type DefaultedReportData,
  type DefaultedReportRowData
} from "./defaultedReport.js";

export {
  renewalReport,
  renewalReportInputSchema,
  renewalReportRowInputSchema,
  buildRenewalReportData,
  buildRenewalReportDocument,
  type RenewalReportInput,
  type RenewalReportRowInput,
  type RenewalReportData,
  type RenewalReportRowData,
  type RenewalRowStatus
} from "./renewalReport.js";

export {
  accountingReport,
  accountingReportInputSchema,
  buildAccountingReportData,
  buildAccountingReportDocument,
  type AccountingReportInput,
  type AccountingReportSnapshot,
  type AccountingReportAccountRow,
  type AccountingReportTransactionRow
} from "./accountingReport.js";
