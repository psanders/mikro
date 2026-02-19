/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * @mikro/common - Common utilities and shared code for Mikro
 */

// Errors
export { ValidationError, type FieldError } from "./errors/index.js";

// Utilities
export {
  withErrorHandlingAndValidation,
  validatePhone,
  getCycleMetrics,
  dayOfWeekToNumber,
  daysToFirstPreferredDay,
  MS_PER_DAY,
  DEFAULT_ADJUSTMENT_PER_PERIOD,
  DEFAULT_MIN_RATE,
  DEFAULT_MAX_RATE,
  DEFAULT_OPTIONS_RANGE,
  DEFAULT_PAYMENT_ROUNDING_INCREMENT,
  type LoanPaymentData,
  type CycleMetrics
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
  getTimesLateInLastWeeks,
  getLatenessTrend,
  getPaymentRating,
  getReportRowHighlight,
  formatPaymentFrequency,
  type LatenessTrend,
  type ReportRowHighlight
} from "./utils/customerReportHelpers.js";
export {
  buildGroupedCustomerRows,
  type CustomerForGrouping,
  type LoanForGrouping,
  type GroupedCustomerRow,
  type GroupedCustomerRows
} from "./utils/customerReportGrouping.js";

// Schemas
export {
  // Customer schemas
  createCustomerSchema,
  updateCustomerSchema,
  getCustomerSchema,
  getCustomerByPhoneSchema,
  listCustomersSchema,
  listCustomersByReferrerSchema,
  listCustomersByCollectorSchema,
  exportCollectorCustomersSchema,
  exportCustomersByReferrerSchema,
  exportAllCustomersSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type GetCustomerInput,
  type GetCustomerByPhoneInput,
  type ListCustomersInput,
  type ListCustomersByReferrerInput,
  type ListCustomersByCollectorInput,
  type ExportCollectorCustomersInput,
  type ExportCustomersByReferrerInput,
  type ExportAllCustomersInput,
  // User schemas
  roleEnum,
  createUserSchema,
  updateUserSchema,
  getUserSchema,
  getUserByPhoneSchema,
  listUsersSchema,
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
  listLoansSchema,
  listLoansByReferrerSchema,
  listLoansByCollectorSchema,
  listLoansByCustomerSchema,
  type CreateLoanInput,
  type CalculateLoanInput,
  type GetLoanInput,
  type GetLoanByLoanIdInput,
  type UpdateLoanStatusInput,
  type ListLoansInput,
  type ListLoansByReferrerInput,
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
  createPaymentSchema,
  reversePaymentSchema,
  listPaymentsSchema,
  listPaymentsByCustomerSchema,
  listPaymentsByReferrerSchema,
  listPaymentsByLoanIdSchema,
  type CreatePaymentInput,
  type ReversePaymentInput,
  type ListPaymentsInput,
  type ListPaymentsByCustomerInput,
  type ListPaymentsByReferrerInput,
  type ListPaymentsByLoanIdInput,
  type PaymentMethod,
  type PaymentStatus,
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
  type GeneratePerformanceReportInput,
  type GeneratePortfolioMetricsInput,
  type GenerateDefaultedReportInput,
  // Collection schemas
  runCollectionsSchema,
  runSingleCollectionSchema,
  type RunCollectionsInput,
  type RunSingleCollectionInput
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
  renderDefaultedReportToPng
} from "./reports/index.js";
export type { NoteForSummary, DefaultedReportRow } from "./reports/index.js";

// Types (entities and client)
export type { Customer } from "./types/index.js";
export type { User, UserWithRole } from "./types/index.js";
export type { Attachment, Message } from "./types/index.js";
export type {
  DbClient,
  UserRole,
  PaymentWithRelations,
  CustomerWithLoansAndReferrer
} from "./types/index.js";
export type {
  WhatsAppClient,
  WhatsAppSendResponse,
  WhatsAppMediaUploadResponse
} from "./types/index.js";
export type { Loan, Payment, LoanNote } from "./types/index.js";

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
