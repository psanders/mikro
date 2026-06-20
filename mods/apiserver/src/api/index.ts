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
  createListCustomersByCollector,
  createExportCollectorCustomers,
  createExportAllCustomers
} from "./customers/index.js";

// Chat operations
export { createGetChatHistory, createAddMessageToChatHistory } from "./chat/index.js";

// Loan operations
export {
  createCreateLoan,
  createUpdateLoanStatus,
  createListLoans,
  createListLoansByCollector,
  createListLoansByCustomer,
  createGetLoanByLoanId,
  createCalculateLoan
} from "./loans/index.js";

// Loan application (intake + review) operations
export {
  createUpsertApplication,
  createFindLatestApplicationByPhone,
  createGetApplicationByPhone,
  createSubmitApplicationFromFlow,
  createSendApplicationPromo,
  createListApplications,
  createGetApplication,
  createClaimApplication,
  createApproveApplication,
  createRejectApplication,
  createReopenApplication,
  createUploadSignedContract,
  createGetApplicationContract,
  createConvertApplication,
  createUpdateApplication
} from "./applications/index.js";

// Payment operations
export {
  createCreatePayment,
  type CreateCreatePaymentOptions,
  type CreatePaymentResult,
  createReversePayment,
  createPreviewLateFee,
  createListPayments,
  createListPaymentsByCustomer,
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
