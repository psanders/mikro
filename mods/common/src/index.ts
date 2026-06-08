/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * @mikro/common - Common utilities and shared code for Mikro
 */

// Config (mikro.json schema and loader)
export {
  loadConfig,
  getConfig,
  getConfigFilePath,
  getDatabaseUrlFromFile,
  DEFAULT_DATABASE_URL,
  resolvePathFromConfigDir,
  getLogoPath,
  clearConfigCache,
  mikroConfigSchema,
  loansSchema,
  llmConfigSchema,
  LLM_VENDORS,
  DEFAULT_NEAR_COMPLETION_THRESHOLDS,
  type MikroConfig,
  type ResolvedMikroConfig,
  type LoansConfig,
  type LLMConfig,
  type LLMVendor
} from "./config.js";

// Errors
export { ValidationError, type FieldError } from "./errors/index.js";

// Utilities
export {
  withErrorHandlingAndValidation,
  validatePhone,
  getCycleMetrics,
  getDueDateForCycle,
  getLateDaysThreshold,
  dayOfWeekToNumber,
  daysToFirstPreferredDay,
  MS_PER_DAY,
  DEFAULT_ADJUSTMENT_PER_PERIOD,
  DEFAULT_MIN_RATE,
  DEFAULT_MAX_RATE,
  DEFAULT_OPTIONS_RANGE,
  DEFAULT_PAYMENT_ROUNDING_INCREMENT,
  calculateLoanOptions,
  formatMoney,
  computeAccruedMora,
  daysLateFromOldestDue,
  amountToNumber,
  toLoanPaymentData,
  toCollectedLateFeePayments,
  type LoanPaymentData,
  type LoanWithPaymentsForMora,
  type CycleMetrics,
  type FormatMoneyInput,
  type ComputeAccruedMoraInput,
  type ComputeAccruedMoraResult,
  type CollectedLateFeePayment,
  type CalculateLoanParams,
  type CalculateLoanResult,
  type LoanOption,
  type LoanPaymentFrequency,
  computePaymentSplit,
  type PaymentSplitInput,
  type PaymentSplitResult
} from "./utils/index.js";
export {
  LOOKBACK_WEEKS_FOR_LATENESS,
  TREND_LOOKBACK_WEEKS,
  LATE_DAYS_THRESHOLD,
  HIGHLIGHT_YELLOW_MIN_MISSED,
  HIGHLIGHT_YELLOW_TIMES_LATE_IN_LOOKBACK,
  HIGHLIGHT_RED_MIN_MISSED,
  HIGHLIGHT_RED_DETERIORATING_MIN_MISSED,
  COLLECTION_OVERDUE_MIN_MISSED,
  COLLECTION_CALL_MIN_MISSED,
  COLLECTION_MESSAGE_DELAY_MS
} from "./utils/customerReportConstants.js";
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
} from "./utils/customerReportHelpers.js";
export {
  getRemainingInstallments,
  getNearCompletionThreshold,
  isNearCompletion,
  getRenewalCandidateMetrics,
  type LoanPaymentDataWithTerm,
  type RenewalCandidateMetrics
} from "./utils/renewalReportHelpers.js";
export {
  buildGroupedCustomerRows,
  type CustomerForGrouping,
  type LoanForGrouping,
  type GroupedCustomerRow,
  type GroupedCustomerRows
} from "./utils/customerReportGrouping.js";

// Schemas
export {
  // Safe date schemas (drop null/empty/invalid instead of coercing to epoch)
  safeOptionalDate,
  safeRequiredDate,
  MIN_ACCEPTED_DATE_MS,
  // Loan application (intake) schemas
  applicationPayloadSchema,
  normalizeApplication,
  applicationStatusEnum,
  listApplicationsSchema,
  getApplicationSchema,
  claimApplicationSchema,
  approveApplicationSchema,
  rejectApplicationSchema,
  reopenApplicationSchema,
  resolveReviewTransition,
  getApplicationContractSchema,
  uploadSignedContractSchema,
  convertApplicationSchema,
  updateApplicationSchema,
  APPLICATION_STABLE_KEYS,
  APPLICATION_RAW_ONLY_KEYS,
  APPLICATION_CONTENT_KEYS,
  type ApplicationPayload,
  type NormalizedApplication,
  type NormalizedApplicationFields,
  type ListApplicationsInput,
  type GetApplicationInput,
  type ClaimApplicationInput,
  type ApproveApplicationInput,
  type RejectApplicationInput,
  type ReopenApplicationInput,
  type ReviewAction,
  type GetApplicationContractInput,
  type UploadSignedContractInput,
  type ConvertApplicationInput,
  type UpdateApplicationInput,
  // Customer schemas
  createCustomerSchema,
  updateCustomerSchema,
  getCustomerSchema,
  getCustomerByPhoneSchema,
  listCustomersSchema,
  listCustomersByCollectorSchema,
  exportCollectorCustomersSchema,
  exportAllCustomersSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type GetCustomerInput,
  type GetCustomerByPhoneInput,
  type ListCustomersInput,
  type ListCustomersByCollectorInput,
  type ExportCollectorCustomersInput,
  type ExportAllCustomersInput,
  // User schemas
  roleEnum,
  loginSchema,
  createUserSchema,
  updateUserSchema,
  getUserSchema,
  getUserByPhoneSchema,
  listUsersSchema,
  type LoginInput,
  type CreateUserInput,
  type UpdateUserInput,
  type GetUserInput,
  type GetUserByPhoneInput,
  type ListUsersInput,
  type Role,
  // Message schemas
  messageRoleEnum,
  attachmentTypeEnum,
  attachmentInputSchema,
  getChatHistorySchema,
  addMessageSchema,
  type GetChatHistoryInput,
  type AddMessageInput,
  type AttachmentInput,
  type MessageRole,
  type AttachmentType,
  // WhatsApp schemas
  whatsappTextSchema,
  whatsappImageSchema,
  whatsappAudioSchema,
  whatsappMessageTypeEnum,
  whatsappMessageSchema,
  whatsappChangeValueSchema,
  whatsappChangeSchema,
  whatsappEntrySchema,
  whatsappWebhookSchema,
  sendWhatsAppMessageSchema,
  sendWhatsAppTemplateSchema,
  type WhatsAppText,
  type WhatsAppImage,
  type WhatsAppAudio,
  type WhatsAppMessageType,
  type WhatsAppMessage,
  type WhatsAppChangeValue,
  type WhatsAppChange,
  type WhatsAppEntry,
  type WhatsAppWebhookBody,
  type SendWhatsAppMessageInput,
  type SendWhatsAppTemplateInput,
  // Loan schemas
  loanTypeEnum,
  loanStatusEnum,
  updateLoanStatusStatusEnum,
  paymentFrequencyEnum,
  createLoanSchema,
  calculateLoanSchema,
  getLoanSchema,
  getLoanByLoanIdSchema,
  updateLoanStatusSchema,
  updateLoanNicknameSchema,
  listLoansSchema,
  listLoansByCollectorSchema,
  listLoansByCustomerSchema,
  type CreateLoanInput,
  type CalculateLoanInput,
  type GetLoanInput,
  type GetLoanByLoanIdInput,
  type UpdateLoanStatusInput,
  type UpdateLoanNicknameInput,
  type ListLoansInput,
  type ListLoansByCollectorInput,
  type ListLoansByCustomerInput,
  type LoanType,
  type LoanStatus,
  type PaymentFrequency,
  // Loan note schemas
  createLoanNoteSchema,
  listLoanNotesByLoanSchema,
  type CreateLoanNoteInput,
  type ListLoanNotesByLoanInput,
  // Payment schemas
  paymentMethodEnum,
  paymentStatusEnum,
  paymentKindEnum,
  createPaymentSchema,
  previewLateFeeSchema,
  reversePaymentSchema,
  listPaymentsSchema,
  listPaymentsByCustomerSchema,
  listPaymentsByLoanIdSchema,
  type CreatePaymentInput,
  type PreviewLateFeeInput,
  type ReversePaymentInput,
  type ListPaymentsInput,
  type ListPaymentsByCustomerInput,
  type ListPaymentsByLoanIdInput,
  type PaymentMethod,
  type PaymentStatus,
  type PaymentKind,
  // Receipt schemas
  generateReceiptSchema,
  receiptDataSchema,
  sendReceiptViaWhatsAppSchema,
  type GenerateReceiptInput,
  type ReceiptDataInput,
  type SendReceiptViaWhatsAppInput,
  // Report schemas
  generatePerformanceReportSchema,
  generatePortfolioMetricsSchema,
  generateDefaultedReportSchema,
  generateRenewalCandidatesReportSchema,
  generateAccountingReportSchema,
  type GeneratePerformanceReportInput,
  type GeneratePortfolioMetricsInput,
  type GenerateDefaultedReportInput,
  type GenerateRenewalCandidatesReportInput,
  type GenerateAccountingReportInput,
  // Dashboard schemas
  getCollectorDashboardSchema,
  type GetCollectorDashboardInput,
  // Accounting schemas
  accountKindEnum,
  transactionTypeEnum,
  transactionStatusEnum,
  categoryKindEnum,
  attachmentMimeTypeEnum,
  allowedAttachmentMimeTypes,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_TRANSACTION,
  MAX_TRPC_REQUEST_BYTES,
  createAccountSchema,
  updateAccountSchema,
  listAccountsSchema,
  getAccountSchema,
  createCategorySchema,
  listCategoriesSchema,
  transactionAttachmentInputSchema,
  createTransactionSchema,
  createTransactionInternalSchema,
  reverseTransactionSchema,
  reverseTransactionInternalSchema,
  listTransactionsSchema,
  getTransactionSchema,
  getTransactionAttachmentSchema,
  type AccountKind,
  type TransactionType,
  type TransactionStatus,
  type CategoryKind,
  type CreateAccountInput,
  type UpdateAccountInput,
  type ListAccountsInput,
  type GetAccountInput,
  type CreateCategoryInput,
  type ListCategoriesInput,
  type TransactionAttachmentInput,
  type CreateTransactionInput,
  type CreateTransactionInternalInput,
  type ReverseTransactionInput,
  type ReverseTransactionInternalInput,
  type ListTransactionsInput,
  type GetTransactionInput,
  type GetTransactionAttachmentInput
} from "./schemas/index.js";

// Report types and helpers
export type {
  PortfolioMetrics,
  LoansByStatus,
  LoansBySize,
  ReportNarrative
} from "./reports/index.js";
export {
  buildReportNarrativePrompt,
  parseReportNarrativeResponse,
  renderPerformanceReportToPng,
  loadLogoDataUrl,
  createPerformanceReportLayout,
  REPORT_WIDTH,
  REPORT_HEIGHT,
  createCustomersReportLayout,
  getCustomersReportHeight,
  CUSTOMERS_REPORT_WIDTH,
  renderCustomersReportToPng,
  buildLoanNotesSummaryPrompt,
  parseLoanNotesSummaryResponse,
  createDefaultedReportLayout,
  getDefaultedReportHeight,
  DEFAULTED_REPORT_WIDTH,
  renderDefaultedReportToPng,
  buildRenewalCandidateNotePrompt,
  parseRenewalCandidateNoteResponse,
  createRenewalReportLayout,
  getRenewalReportHeight,
  RENEWAL_REPORT_WIDTH,
  renderRenewalReportToPng,
  createAccountingReportLayout,
  getAccountingReportHeight,
  ACCOUNTING_REPORT_WIDTH,
  renderAccountingReportToPng
} from "./reports/index.js";
export type {
  NoteForSummary,
  DefaultedReportRow,
  RenewalCandidateContext,
  RenewalReportRow,
  AccountingReportAccount,
  AccountingReportTransaction,
  AccountingReportData
} from "./reports/index.js";

// Types (entities and client)
export type { Customer } from "./types/index.js";
export type { User, UserWithRole } from "./types/index.js";
export type { Attachment, Message } from "./types/index.js";
export type {
  DbClient,
  UserRole,
  PaymentWithRelations,
  CustomerWithLoans,
  LoanApplicationWriteData
} from "./types/index.js";
export type { LoanApplication, ApplicationStatus } from "./types/index.js";
export type {
  WhatsAppClient,
  WhatsAppSendResponse,
  WhatsAppMediaUploadResponse
} from "./types/index.js";
export type { Loan, Payment, LoanNote } from "./types/index.js";
export type {
  AccountingAccount,
  AccountingCategory,
  AccountingTransaction,
  AccountingTransactionAttachment,
  AccountingTransactionWithRelations,
  AccountingTransactionAttachmentPayload
} from "./types/index.js";

// Loan application scoring (deterministic Mikro Score engine)
export {
  scoreApplication,
  scoreInput,
  CONFIG as SCORING_CONFIG,
  MAPA_CODIGOS,
  PUNTAJE_POR_NIVEL,
  type ScoreInput,
  type ApplicationScore,
  type RiskBand,
  type Recommendation,
  type Confidence,
  type FlagCode,
  type ScoreCategoryKey,
  type ScoreFlag,
  type ScoreCategory,
  type ScoreIndicator,
  type ScoreIndicators,
  type EvaluatorNote,
  type RiskLevel
} from "./scoring/index.js";

// Receipt utilities
export { generateKeys, type GeneratedKeys } from "./receipt/index.js";

// Receipt generator (from data, no DB)
export {
  createGenerateReceiptFromData,
  renderReceiptToImage,
  loadPrivateKey,
  createSignedToken,
  generateQRCode,
  loadFonts,
  createReceiptLayout,
  RECEIPT_WIDTH,
  RECEIPT_HEIGHT,
  type GenerateReceiptResponse,
  type ReceiptData,
  type ReceiptLogger,
  type CreateGenerateReceiptFromDataDeps,
  type Font,
  type ReceiptElement
} from "./receipts/index.js";
