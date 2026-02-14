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
  HIGHLIGHT_RED_DETERIORATING_MIN_MISSED
} from "./utils/memberReportConstants.js";
export {
  getMissedPaymentsCount,
  getTimesLateInLastWeeks,
  getLatenessTrend,
  getPaymentRating,
  getReportRowHighlight,
  type LatenessTrend,
  type ReportRowHighlight
} from "./utils/memberReportHelpers.js";

// Schemas
export {
  // Member schemas
  createMemberSchema,
  updateMemberSchema,
  getMemberSchema,
  getMemberByPhoneSchema,
  listMembersSchema,
  listMembersByReferrerSchema,
  listMembersByCollectorSchema,
  exportCollectorMembersSchema,
  exportMembersByReferrerSchema,
  exportAllMembersSchema,
  type CreateMemberInput,
  type UpdateMemberInput,
  type GetMemberInput,
  type GetMemberByPhoneInput,
  type ListMembersInput,
  type ListMembersByReferrerInput,
  type ListMembersByCollectorInput,
  type ExportCollectorMembersInput,
  type ExportMembersByReferrerInput,
  type ExportAllMembersInput,
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
  whatsappMessageTypeEnum,
  whatsappMessageSchema,
  whatsappChangeValueSchema,
  whatsappChangeSchema,
  whatsappEntrySchema,
  whatsappWebhookSchema,
  sendWhatsAppMessageSchema,
  type WhatsAppText,
  type WhatsAppImage,
  type WhatsAppMessageType,
  type WhatsAppMessage,
  type WhatsAppChangeValue,
  type WhatsAppChange,
  type WhatsAppEntry,
  type WhatsAppWebhookBody,
  type SendWhatsAppMessageInput,
  // Loan schemas
  loanTypeEnum,
  loanStatusEnum,
  updateLoanStatusStatusEnum,
  paymentFrequencyEnum,
  createLoanSchema,
  getLoanSchema,
  getLoanByLoanIdSchema,
  updateLoanStatusSchema,
  listLoansSchema,
  listLoansByReferrerSchema,
  listLoansByCollectorSchema,
  listLoansByMemberSchema,
  type CreateLoanInput,
  type GetLoanInput,
  type GetLoanByLoanIdInput,
  type UpdateLoanStatusInput,
  type ListLoansInput,
  type ListLoansByReferrerInput,
  type ListLoansByCollectorInput,
  type ListLoansByMemberInput,
  type LoanType,
  type LoanStatus,
  type PaymentFrequency,
  // Payment schemas
  paymentMethodEnum,
  paymentStatusEnum,
  createPaymentSchema,
  reversePaymentSchema,
  listPaymentsSchema,
  listPaymentsByMemberSchema,
  listPaymentsByReferrerSchema,
  listPaymentsByLoanIdSchema,
  type CreatePaymentInput,
  type ReversePaymentInput,
  type ListPaymentsInput,
  type ListPaymentsByMemberInput,
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
  type GeneratePerformanceReportInput,
  type GeneratePortfolioMetricsInput
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
  createPerformanceReportLayout,
  REPORT_WIDTH,
  REPORT_HEIGHT
} from "./reports/index.js";

// Types (entities and client)
export type { Member } from "./types/index.js";
export type { User, UserWithRole } from "./types/index.js";
export type { Attachment, Message } from "./types/index.js";
export type {
  DbClient,
  UserRole,
  PaymentWithRelations,
  MemberWithLoansAndReferrer
} from "./types/index.js";
export type {
  WhatsAppClient,
  WhatsAppSendResponse,
  WhatsAppMediaUploadResponse
} from "./types/index.js";
export type { Loan, Payment } from "./types/index.js";

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
