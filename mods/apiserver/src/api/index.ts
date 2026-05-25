/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

// Auth operations
export { createLogin, type LoginResult } from "./auth/index.js";

// User operations
export {
  createCreateUser,
  createUpdateUser,
  createGetUser,
  createGetUserByPhone,
  createListUsers,
  type UserWithRoles
} from "./users/index.js";

// Customer operations
export {
  createCreateCustomer,
  createUpdateCustomer,
  createGetCustomer,
  createGetCustomerByPhone,
  createListCustomers,
  createListCustomersByReferrer,
  createListCustomersByCollector,
  createExportCollectorCustomers,
  createExportCustomersByReferrer,
  createExportAllCustomers
} from "./customers/index.js";

// Chat operations
export { createGetChatHistory, createAddMessageToChatHistory } from "./chat/index.js";

// Loan operations
export {
  createCreateLoan,
  createUpdateLoanStatus,
  createListLoans,
  createListLoansByReferrer,
  createListLoansByCollector,
  createListLoansByCustomer,
  createGetLoanByLoanId,
  createCalculateLoan
} from "./loans/index.js";

// Payment operations
export {
  createCreatePayment,
  type CreateCreatePaymentOptions,
  type CreatePaymentResult,
  createReversePayment,
  createPreviewLateFee,
  createListPayments,
  createListPaymentsByCustomer,
  createListPaymentsByReferrer,
  createListPaymentsByLoanId
} from "./payments/index.js";

// Receipt operations
export {
  createGenerateReceipt,
  createSendReceiptViaWhatsApp,
  type GenerateReceiptResponse,
  type ReceiptDependencies,
  type SendReceiptViaWhatsAppResponse,
  type SendReceiptViaWhatsAppDependencies
} from "./receipts/index.js";

// Dashboard operations
export { createGetCollectorDashboard } from "./dashboard/index.js";

// Sync operations
export {
  createCollectorSync,
  type CollectorSyncResult,
  type CustomerSnapshot,
  type LoanSnapshot,
  type PaymentSnapshot,
  type LoanNoteSnapshot,
  type MoraConfig
} from "./sync/index.js";

// Report operations
export {
  createGeneratePortfolioMetrics,
  createGeneratePerformanceReport,
  createGenerateDefaultedReport,
  createGenerateRenewalCandidatesReport
} from "./reports/index.js";
