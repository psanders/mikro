/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { randomUUID } from "crypto";
import {
  // Customer schemas
  createCustomerSchema,
  updateCustomerSchema,
  getCustomerSchema,
  listCustomersSchema,
  listCustomersByCollectorSchema,
  exportCollectorCustomersSchema,
  exportAllCustomersSchema,
  // User schemas
  createUserSchema,
  updateUserSchema,
  getUserSchema,
  listUsersSchema,
  // Chat schemas
  getChatHistorySchema,
  // Loan schemas
  createLoanSchema,
  calculateLoanSchema,
  updateLoanStatusSchema,
  updateLoanNicknameSchema,
  listLoansSchema,
  listLoansByCollectorSchema,
  listLoansByCustomerSchema,
  getLoanByLoanIdSchema,
  // Payment schemas
  createPaymentSchema,
  previewLateFeeSchema,
  reversePaymentSchema,
  listPaymentsSchema,
  listPaymentsByCustomerSchema,
  listPaymentsByLoanIdSchema,
  // Receipt schemas
  generateReceiptSchema,
  receiptDataSchema,
  sendReceiptViaWhatsAppSchema,
  sendPaymentConfirmationSchema,
  // Report schemas
  generatePortfolioMetricsSchema,
  generatePerformanceReportSchema,
  generateDefaultedReportSchema,
  generateRenewalCandidatesReportSchema,
  generateAccountingReportSchema,
  generateModeloReportSchema,
  // Loan note schemas
  createLoanNoteSchema,
  listLoanNotesByLoanSchema,
  // Loan application schemas
  listApplicationsSchema,
  getApplicationSchema,
  claimApplicationSchema,
  approveApplicationSchema,
  rejectApplicationSchema,
  reopenApplicationSchema,
  promoteApplicationSchema,
  uploadSignedContractSchema,
  getApplicationContractSchema,
  generateApplicationContractSchema,
  convertApplicationSchema,
  updateApplicationSchema,
  createApplicationSchema,
  deleteApplicationSchema,
  uploadIdImageSchema,
  getIdImageSchema,
  deleteIdImageSchema,
  deleteApplicationContractSchema,
  generateApplicationSummarySchema,
  sendPromoSchema,
  // Customer tag schemas
  setCustomerTagSchema,
  clearCustomerTagSchema,
  listCustomerTagsSchema
} from "@mikro/common";
import { TRPCError } from "@trpc/server";
import {
  router,
  protectedProcedure,
  reviewerProcedure,
  adminProcedure,
  collectorProcedure
} from "../trpc.js";
// Customer API functions
import { createCreateCustomer } from "../../api/customers/createCreateCustomer.js";
import { createUpdateCustomer } from "../../api/customers/createUpdateCustomer.js";
import { createGetCustomer } from "../../api/customers/createGetCustomer.js";
import { createListCustomers } from "../../api/customers/createListCustomers.js";
import { createListCustomersByCollector } from "../../api/customers/createListCustomersByCollector.js";
import { createExportCollectorCustomers } from "../../api/customers/createExportCollectorCustomers.js";
import { createExportAllCustomers } from "../../api/customers/createExportAllCustomers.js";
// User API functions
import { createCreateUser } from "../../api/users/createCreateUser.js";
import { createUpdateUser } from "../../api/users/createUpdateUser.js";
import { createGetUser } from "../../api/users/createGetUser.js";
import { createListUsers } from "../../api/users/createListUsers.js";
// Chat API functions
import { createGetChatHistory } from "../../api/chat/createGetChatHistory.js";
// Dashboard API functions
import { createGetCollectorDashboard } from "../../api/dashboard/createGetCollectorDashboard.js";
// Sync API functions
import { createCollectorSync } from "../../api/sync/createCollectorSync.js";
// Customer tag API functions
import { createSetCustomerTag } from "../../api/tags/createSetCustomerTag.js";
import { createClearCustomerTag } from "../../api/tags/createClearCustomerTag.js";
import { createListCustomerTags } from "../../api/tags/createListCustomerTags.js";
// Loan API functions
import { createCreateLoan } from "../../api/loans/createCreateLoan.js";
import { createUpdateLoanStatus } from "../../api/loans/createUpdateLoanStatus.js";
import { createUpdateLoanNickname } from "../../api/loans/createUpdateLoanNickname.js";
import { createListLoans } from "../../api/loans/createListLoans.js";
import { createListLoansByCollector } from "../../api/loans/createListLoansByCollector.js";
import { createListLoansByCustomer } from "../../api/loans/createListLoansByCustomer.js";
import { createCalculateLoan } from "../../api/loans/createCalculateLoan.js";
import { createGetLoanByLoanId } from "../../api/loans/createGetLoanByLoanId.js";
// Loan application API functions
import { createListApplications } from "../../api/applications/createListApplications.js";
import { createGetApplication } from "../../api/applications/createGetApplication.js";
import {
  createClaimApplication,
  createApproveApplication,
  createRejectApplication,
  createReopenApplication
} from "../../api/applications/reviewApplication.js";
import { createUploadSignedContract } from "../../api/applications/createUploadSignedContract.js";
import { createGetApplicationContract } from "../../api/applications/createGetApplicationContract.js";
import { createGenerateApplicationContract } from "../../api/applications/createGenerateApplicationContract.js";
import { createConvertApplication } from "../../api/applications/createConvertApplication.js";
import { createUpdateApplication } from "../../api/applications/createUpdateApplication.js";
import { createCreateApplication } from "../../api/applications/createCreateApplication.js";
import {
  createSendApplicationPromo,
  type PromoResult
} from "../../api/applications/createSendApplicationPromo.js";
import { createPromoteApplication } from "../../api/applications/createPromoteApplication.js";
import { createDeleteApplication } from "../../api/applications/createDeleteApplication.js";
import { createUploadIdImage } from "../../api/applications/createUploadIdImage.js";
import { createGetIdImage } from "../../api/applications/createGetIdImage.js";
import { createDeleteIdImage } from "../../api/applications/createDeleteIdImage.js";
import { createDeleteApplicationContract } from "../../api/applications/createDeleteApplicationContract.js";
import { createGenerateApplicationSummary } from "../../api/applications/createGenerateApplicationSummary.js";
// Payment API functions
import { createCreatePayment } from "../../api/payments/createCreatePayment.js";
import { createSyncAllPortfolios } from "../../qcobro/index.js";
import { createReversePayment } from "../../api/payments/createReversePayment.js";
import { createListPayments } from "../../api/payments/createListPayments.js";
import { createListPaymentsByCustomer } from "../../api/payments/createListPaymentsByCustomer.js";
import { createListPaymentsByLoanId } from "../../api/payments/createListPaymentsByLoanId.js";
import { createPreviewLateFee } from "../../api/payments/createPreviewLateFee.js";
// Receipt API functions
import { createGenerateReceipt } from "../../api/receipts/createGenerateReceipt.js";
import { createGenerateReceiptFromDataApi } from "../../api/receipts/createGenerateReceiptFromData.js";
import { createSendReceiptViaWhatsApp } from "../../api/receipts/createSendReceiptViaWhatsApp.js";
import { createSendPaymentConfirmation } from "../../api/receipts/createSendPaymentConfirmation.js";
// Report API functions
import { createGeneratePortfolioMetrics } from "../../api/reports/createGeneratePortfolioMetrics.js";
import { createGeneratePerformanceReport } from "../../api/reports/createGeneratePerformanceReport.js";
import { createGenerateDefaultedReport } from "../../api/reports/createGenerateDefaultedReport.js";
import { createGenerateRenewalCandidatesReport } from "../../api/reports/createGenerateRenewalCandidatesReport.js";
import { createGenerateAccountingReport } from "../../api/reports/createGenerateAccountingReport.js";
import { createGenerateModeloReport } from "../../api/reports/createGenerateModeloReport.js";
// Loan note API functions
import { createCreateLoanNote } from "../../api/loanNotes/createCreateLoanNote.js";
import { createListLoanNotesByLoan } from "../../api/loanNotes/createListLoanNotesByLoan.js";
// WhatsApp functions
import {
  createSendWhatsAppMessage,
  createWhatsAppClient,
  getWhatsAppPromoTemplate,
  getDeepgramApiKey,
  createChatModel,
  getLLMConfig
} from "@mikro/agents";
import type { PrismaClient } from "../../generated/prisma/client.js";
// Accounting schemas
import {
  createAccountSchema,
  updateAccountSchema,
  listAccountsSchema,
  getAccountSchema,
  createCategorySchema,
  listCategoriesSchema,
  createTransactionSchema,
  reverseTransactionSchema,
  listTransactionsSchema,
  getTransactionSchema,
  getTransactionAttachmentSchema,
  getWhatsAppPaymentConfirmationTemplate,
  getReceiptImageUrl
} from "@mikro/common";
// Founder feed / event-log schemas
import {
  listFeedEventsSchema,
  restoreApplicationSchema,
  searchAllSchema,
  exportAuditLogSchema
} from "@mikro/common";
// Founder feed / event-log API functions
import {
  createListFeedEvents,
  createRestoreApplication,
  createSearchAll,
  createExportAuditLog
} from "../../api/events/index.js";
// Founder copilot schemas
import {
  copilotChatSchema,
  copilotActionDecisionSchema,
  getCopilotHistorySchema,
  listWatchRulesSchema,
  setWatchRuleEnabledSchema
} from "@mikro/common";
// Founder copilot API functions
import {
  createCopilotChat,
  createConfirmCopilotAction,
  createRejectCopilotAction,
  createGetCopilotHistory,
  listWatchRules as listWatchRulesFn,
  setWatchRuleEnabled as setWatchRuleEnabledFn,
  getCopilotDeps
} from "../../api/copilot/index.js";
// Bug report schema + API function
import { submitBugReportSchema, getConfig } from "@mikro/common";
import { createSubmitBugReport } from "../../api/bugReports/createSubmitBugReport.js";
import { createTranscribeVoiceNote } from "../../voice/createTranscribeVoiceNote.js";
import { Octokit } from "@octokit/rest";
// Accounting API functions
import {
  createCreateAccount,
  createUpdateAccount,
  createListAccounts,
  createGetAccount,
  createCreateCategory,
  createListCategories,
  createCreateTransaction,
  createReverseTransaction,
  createListTransactions,
  createGetTransaction,
  createGetTransactionAttachment
} from "../../api/accounting/index.js";

// In-memory per-user cooldown for submitBugReport (mikro/#69) — keeps a
// stuck client from spamming the target repo with issues. Not persisted:
// a server restart resets it, which is fine for a spam guard, not a hard limit.
const bugReportRateLimit = new Map<string, number>();
const BUG_REPORT_RATE_LIMIT_MS = 60 * 1000;

/**
 * Protected router - procedures that require Basic Auth.
 */
export const protectedRouter = router({
  // ==================== Dashboard procedures ====================

  getCollectorDashboard: protectedProcedure.query(async ({ ctx }) => {
    const fn = createGetCollectorDashboard(ctx.db);
    return fn({ collectorId: ctx.userId });
  }),

  collectorSync: protectedProcedure.query(async ({ ctx }) => {
    const fn = createCollectorSync(ctx.db);
    const includePayments = ctx.roles.includes("ADMIN") || ctx.roles.includes("COLLECTOR");
    return fn({ collectorId: ctx.userId, includePayments });
  }),

  // ==================== Customer procedures ====================

  /**
   * Create a new customer.
   */
  createCustomer: protectedProcedure
    .meta({ event: "customer.created" })
    .input(createCustomerSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createCreateCustomer(ctx.db);
      return fn(input);
    }),

  /**
   * Update an existing customer.
   */
  updateCustomer: protectedProcedure
    .input(updateCustomerSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createUpdateCustomer(ctx.db);
      return fn(input);
    }),

  /**
   * Get a customer by ID.
   */
  getCustomer: protectedProcedure.input(getCustomerSchema).query(async ({ ctx, input }) => {
    const fn = createGetCustomer(ctx.db);
    return fn(input);
  }),

  /**
   * List all customers with optional pagination.
   */
  listCustomers: protectedProcedure.input(listCustomersSchema).query(async ({ ctx, input }) => {
    const fn = createListCustomers(ctx.db);
    return fn(input);
  }),

  /**
   * List customers by collector ID.
   */
  listCustomersByCollector: protectedProcedure
    .input(listCustomersByCollectorSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListCustomersByCollector(ctx.db);
      return fn(input);
    }),

  /**
   * Export customers by collector ID with loans for report generation.
   * Returns customers with active loans and payment status.
   */
  exportCollectorCustomers: protectedProcedure
    .input(exportCollectorCustomersSchema)
    .query(async ({ ctx, input }) => {
      const fn = createExportCollectorCustomers(ctx.db);
      return fn(input);
    }),

  /**
   * Export all active customers with loans for report generation.
   * Admin-only operation that returns all customers with active loans and payment status.
   */
  exportAllCustomers: protectedProcedure.input(exportAllCustomersSchema).query(async ({ ctx }) => {
    const fn = createExportAllCustomers(ctx.db);
    return fn({});
  }),

  // ==================== Customer tag procedures ====================
  // MANUAL risk: tags only — status:/dpd: are AUTO and owned by the tag engine.
  // No dashboard UI in v1; this API + the mikro CLI are the only way to set them.

  /**
   * Set (create or refresh) a MANUAL risk: tag on a customer.
   */
  setCustomerTag: protectedProcedure
    .input(setCustomerTagSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createSetCustomerTag(ctx.db);
      return fn(input);
    }),

  /**
   * Clear a MANUAL risk: tag from a customer.
   */
  clearCustomerTag: protectedProcedure
    .input(clearCustomerTagSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createClearCustomerTag(ctx.db);
      return fn(input);
    }),

  /**
   * List every tag (AUTO + MANUAL) currently on a customer.
   */
  listCustomerTags: protectedProcedure
    .input(listCustomerTagsSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListCustomerTags(ctx.db);
      return fn(input);
    }),

  // ==================== User procedures ====================

  /**
   * Return the authenticated caller's own user record and roles.
   * Used by CLI/mobile clients to verify a token and show "logged in as X".
   */
  whoami: protectedProcedure.query(async ({ ctx }) => {
    const fn = createGetUser(ctx.db);
    const user = await fn({ id: ctx.userId });
    if (!user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "User no longer exists" });
    }
    return { ...user, roles: ctx.roles };
  }),

  /**
   * Create a new user.
   */
  createUser: protectedProcedure.input(createUserSchema).mutation(async ({ ctx, input }) => {
    const fn = createCreateUser(ctx.db);
    return fn(input);
  }),

  /**
   * Update an existing user.
   */
  updateUser: protectedProcedure.input(updateUserSchema).mutation(async ({ ctx, input }) => {
    const fn = createUpdateUser(ctx.db);
    return fn(input);
  }),

  /**
   * Get a user by ID.
   */
  getUser: protectedProcedure.input(getUserSchema).query(async ({ ctx, input }) => {
    const fn = createGetUser(ctx.db);
    return fn(input);
  }),

  /**
   * List all users with optional pagination.
   */
  listUsers: protectedProcedure.input(listUsersSchema).query(async ({ ctx, input }) => {
    const fn = createListUsers(ctx.db);
    return fn(input);
  }),

  // ==================== Chat procedures ====================

  /**
   * Get chat history for a customer or user.
   */
  getChatHistory: protectedProcedure.input(getChatHistorySchema).query(async ({ ctx, input }) => {
    const fn = createGetChatHistory(ctx.db);
    return fn(input);
  }),

  // ==================== Loan procedures ====================

  /**
   * Create a new loan for a customer.
   */
  createLoan: protectedProcedure.input(createLoanSchema).mutation(async ({ ctx, input }) => {
    const fn = createCreateLoan(ctx.db);
    return fn(input);
  }),

  /**
   * Calculate loan repayment options from principal, interest rate and duration.
   */
  calculateLoan: protectedProcedure.input(calculateLoanSchema).query(async ({ input }) => {
    const fn = createCalculateLoan();
    return fn(input);
  }),

  /**
   * List all loans with optional pagination.
   * By default only shows ACTIVE loans.
   */
  listLoans: protectedProcedure.input(listLoansSchema).query(async ({ ctx, input }) => {
    const fn = createListLoans(ctx.db);
    return fn(input);
  }),

  /**
   * List loans for customers assigned to a specific collector.
   */
  listLoansByCollector: protectedProcedure
    .input(listLoansByCollectorSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListLoansByCollector(ctx.db);
      return fn(input);
    }),

  /**
   * List loans for a specific customer by ID.
   */
  listLoansByCustomer: protectedProcedure
    .input(listLoansByCustomerSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListLoansByCustomer(ctx.db);
      return fn(input);
    }),

  /**
   * Get a single loan by numeric loan ID (includes customer for collector checks).
   */
  getLoanByLoanId: protectedProcedure.input(getLoanByLoanIdSchema).query(async ({ ctx, input }) => {
    const fn = createGetLoanByLoanId(ctx.db);
    return fn(input);
  }),

  /**
   * Update a loan's status to COMPLETED, DEFAULTED, or CANCELLED.
   */
  updateLoanStatus: protectedProcedure
    .meta({ event: "loan.status_changed" })
    .input(updateLoanStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createUpdateLoanStatus(ctx.db);
      return fn(input);
    }),

  /**
   * Update a loan's nickname (set or clear).
   */
  updateLoanNickname: protectedProcedure
    .input(updateLoanNicknameSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createUpdateLoanNickname(ctx.db);
      return fn(input);
    }),

  // ==================== Loan note procedures ====================

  /**
   * Add a note to a loan (by numeric loanId). Records who created it and when.
   */
  createLoanNote: protectedProcedure
    .input(createLoanNoteSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createCreateLoanNote(ctx.db);
      return fn(input);
    }),

  /**
   * List all notes for a loan (by numeric loanId), newest first.
   */
  listLoanNotesByLoan: protectedProcedure
    .input(listLoanNotesByLoanSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListLoanNotesByLoan(ctx.db);
      return fn(input);
    }),

  // ==================== Loan application procedures ====================

  /**
   * List loan applications (solicitudes) with optional status filter + pagination.
   * Restricted to reviewers (ADMIN/REVIEWER) — applications carry applicant PII.
   */
  listApplications: reviewerProcedure
    .input(listApplicationsSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListApplications(ctx.db);
      return fn(input);
    }),

  /**
   * Get a single loan application by id or sessionId. Reviewers (ADMIN/REVIEWER) only.
   */
  getApplication: reviewerProcedure.input(getApplicationSchema).query(async ({ ctx, input }) => {
    const fn = createGetApplication(ctx.db);
    return fn(input);
  }),

  /**
   * Claim a RECEIVED application for review (-> IN_REVIEW), or — ADMIN only —
   * assign it directly to another reviewer via `assigneeId`. ADMIN/REVIEWER only.
   */
  claimApplication: reviewerProcedure
    .input(claimApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const assigneeId = input.assigneeId ?? ctx.userId;
      if (assigneeId !== ctx.userId) {
        if (!ctx.roles.includes("ADMIN")) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only admins can assign an application to another reviewer."
          });
        }
        const assignee = await ctx.db.user.findUnique({
          where: { id: assigneeId },
          include: { roles: { select: { role: true } } }
        });
        const assigneeRoles = assignee?.roles?.map((r) => r.role) ?? [];
        if (!assignee || !(assigneeRoles.includes("ADMIN") || assigneeRoles.includes("REVIEWER"))) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Assignee must be an existing admin or reviewer."
          });
        }
      }
      const fn = createClaimApplication(ctx.db);
      return fn(input, assigneeId);
    }),

  /**
   * Approve an application (RECEIVED|IN_REVIEW -> APPROVED). ADMIN/REVIEWER only.
   */
  approveApplication: reviewerProcedure
    .meta({ event: "application.approved" })
    .input(approveApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createApproveApplication(ctx.db);
      return fn(input, ctx.userId);
    }),

  /**
   * Reject an application with a reason (RECEIVED|IN_REVIEW -> REJECTED). ADMIN/REVIEWER only.
   */
  rejectApplication: reviewerProcedure
    .meta({ event: "application.rejected" })
    .input(rejectApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createRejectApplication(ctx.db);
      return fn(input, ctx.userId);
    }),

  /**
   * Reopen a decided application (APPROVED|REJECTED -> IN_REVIEW). ADMIN/REVIEWER only.
   */
  reopenApplication: reviewerProcedure
    .input(reopenApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createReopenApplication(ctx.db);
      return fn(input, ctx.userId);
    }),

  /**
   * Promote a reviewer-completed DRAFT into the queue (-> RECEIVED). ADMIN/REVIEWER only.
   */
  promoteApplication: reviewerProcedure
    .input(promoteApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createPromoteApplication(ctx.db);
      return fn(input, ctx.userId);
    }),

  /**
   * Upload a signed contract PDF (APPROVED -> SIGNED). ADMIN/REVIEWER only.
   */
  uploadSignedContract: reviewerProcedure
    .meta({ event: "application.signed" })
    .input(uploadSignedContractSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createUploadSignedContract(ctx.db);
      return fn(input, ctx.userId);
    }),

  /**
   * Fetch the stored signed contract (base64) for an application. ADMIN/REVIEWER only.
   */
  getApplicationContract: reviewerProcedure
    .input(getApplicationContractSchema)
    .query(async ({ ctx, input }) => {
      const fn = createGetApplicationContract(ctx.db);
      return fn(input);
    }),

  /**
   * Render the loan contract PDF for an application from the request data +
   * reviewer-supplied terms (post-approval). ADMIN/REVIEWER only. Stateless.
   */
  generateApplicationContract: reviewerProcedure
    .input(generateApplicationContractSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createGenerateApplicationContract(ctx.db);
      return fn(input);
    }),

  /**
   * Convert a SIGNED application into a Customer + Loan (-> CONVERTED). ADMIN/REVIEWER only.
   */
  convertApplication: reviewerProcedure
    .meta({ event: "application.converted" })
    .input(convertApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createConvertApplication(ctx.db);
      return fn(input, ctx.userId);
    }),

  /**
   * Manually create a new application from the dashboard. ADMIN/REVIEWER only.
   *
   * When `input.sendPromo` is set and the created application has a phone, also
   * sends the approved promo template (CTA opens the intake Flow) to that phone.
   * The send is best-effort: it never rolls back creation. The result carries the
   * full application plus a `promo` outcome (`null` when not requested).
   */
  createApplication: reviewerProcedure
    .input(createApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createCreateApplication(ctx.db);
      const application = await fn(input);

      let promo: PromoResult | null = null;
      if (input.sendPromo) {
        const whatsAppClient = createWhatsAppClient();
        const { templateName, languageCode, imageUrl } = getWhatsAppPromoTemplate();
        const sendPromo = createSendApplicationPromo({
          sendTemplateMessage: whatsAppClient.sendTemplateMessage.bind(whatsAppClient),
          templateName,
          languageCode,
          imageUrl
        });
        promo = await sendPromo({ phone: application.phone, flowToken: application.id });
      }

      return { ...application, promo };
    }),

  /**
   * Edit an application's fields; re-derives + re-scores. ADMIN/REVIEWER only.
   */
  updateApplication: reviewerProcedure
    .input(updateApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createUpdateApplication(ctx.db);
      return fn(input);
    }),

  /**
   * Manually purge (hard delete) an application. Irreversible. ADMIN/REVIEWER only.
   */
  deleteApplication: reviewerProcedure
    .meta({ event: "application.deleted" })
    .input(deleteApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createDeleteApplication(ctx.db);
      return fn(input, ctx.userId);
    }),

  /**
   * Upload one side of the applicant's cédula (static image). ADMIN/REVIEWER only.
   */
  uploadIdImage: reviewerProcedure.input(uploadIdImageSchema).mutation(async ({ ctx, input }) => {
    const fn = createUploadIdImage(ctx.db);
    return fn(input, ctx.userId);
  }),

  /**
   * Fetch a stored cédula image (front/back) as base64. ADMIN/REVIEWER only.
   */
  getIdImage: reviewerProcedure.input(getIdImageSchema).query(async ({ ctx, input }) => {
    const fn = createGetIdImage(ctx.db);
    return fn(input);
  }),

  /** Remove one side of the applicant's cédula. ADMIN/REVIEWER only. */
  deleteIdImage: reviewerProcedure.input(deleteIdImageSchema).mutation(async ({ ctx, input }) => {
    const fn = createDeleteIdImage(ctx.db);
    return fn(input);
  }),

  /** Remove the stored signed contract and revert SIGNED → APPROVED. ADMIN/REVIEWER only. */
  deleteApplicationContract: reviewerProcedure
    .input(deleteApplicationContractSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createDeleteApplicationContract(ctx.db);
      return fn(input);
    }),

  /** Render a printable solicitud summary PDF. ADMIN/REVIEWER only. */
  generateApplicationSummary: reviewerProcedure
    .input(generateApplicationSummarySchema)
    .query(async ({ ctx, input }) => {
      const fn = createGenerateApplicationSummary(ctx.db);
      return fn(input);
    }),

  /**
   * Send the promo template to a phone without creating a loan application.
   * Available to any authenticated user. Best-effort: errors are returned as
   * `{ sent: false, error }` rather than thrown.
   */
  sendPromo: protectedProcedure.input(sendPromoSchema).mutation(async ({ input }) => {
    const whatsAppClient = createWhatsAppClient();
    const { templateName, languageCode, imageUrl } = getWhatsAppPromoTemplate();
    const sendFn = createSendApplicationPromo({
      sendTemplateMessage: whatsAppClient.sendTemplateMessage.bind(whatsAppClient),
      templateName,
      languageCode,
      imageUrl
    });
    // Normalize to E.164 — same logic as normalizeApplication's parsePhone.
    const digits = input.phone.replace(/\D/g, "");
    const e164 =
      digits.length === 10
        ? `+1${digits}`
        : digits.length === 11 && digits.startsWith("1")
          ? `+${digits}`
          : null;
    return sendFn({ phone: e164, flowToken: randomUUID() });
  }),

  /**
   * File a bug report from an in-app screen+mic recording (mikro/#69).
   * Available to any authenticated user, rate-limited per user to keep a
   * stuck client (or a mis-click loop) from spamming the target repo with
   * issues — one report per user per BUG_REPORT_RATE_LIMIT_MS.
   */
  submitBugReport: protectedProcedure
    .input(submitBugReportSchema)
    .mutation(async ({ ctx, input }) => {
      const last = bugReportRateLimit.get(ctx.userId);
      if (last && Date.now() - last < BUG_REPORT_RATE_LIMIT_MS) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Espera un momento antes de enviar otro reporte."
        });
      }
      bugReportRateLimit.set(ctx.userId, Date.now());

      const user = await ctx.db.user.findUnique({ where: { id: ctx.userId } });
      const cfg = getConfig();
      const deepgramApiKey = getDeepgramApiKey();
      if (!deepgramApiKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Bug reporting is not configured (voiceNotes.deepgramApiKey is empty)."
        });
      }
      if (!cfg.githubBugReport.token) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Bug reporting is not configured (githubBugReport.token is empty)."
        });
      }

      const fn = createSubmitBugReport({
        transcribe: createTranscribeVoiceNote(deepgramApiKey),
        createModel: () => createChatModel(getLLMConfig("text"), { temperature: 0.3 }),
        // Without an explicit API version, GitHub routes the request through
        // an implicit legacy version and returns a deprecation warning
        // ("scheduled to be removed" — seen for real on the issues.create
        // call). Pin the current stable version explicitly.
        octokit: new Octokit({
          auth: cfg.githubBugReport.token,
          request: { headers: { "x-github-api-version": "2022-11-28" } }
        }),
        repo: cfg.githubBugReport.repo
      });
      return fn(input, { userId: ctx.userId, name: user?.name ?? "Usuario Mikro" });
    }),

  // ==================== Payment procedures ====================

  /**
   * Create a new payment for a loan. Collector/admin only — REVIEWER must
   * not be able to trigger collections (mikro/#73).
   */
  createPayment: collectorProcedure
    .meta({ event: "payment.collected" })
    .input(createPaymentSchema)
    .mutation(async ({ ctx, input }) => {
      // Block collectors from double-charging the same customer within 5 minutes.
      // Admins (e.g. CTL back-office) bypass the guard.
      const isAdmin = ctx.roles.includes("ADMIN");
      const isCollector = ctx.roles.includes("COLLECTOR");
      const dedupWindowMs = isCollector && !isAdmin ? 5 * 60 * 1000 : undefined;
      // Payments only ever cure an account, so resync QCobro immediately rather
      // than waiting for the cron's deterioration pass. Best-effort: never throws.
      // A full-base pass (not just this customer) — see createSyncAllPortfolios.ts
      // for why a single-customer push isn't safe against the real API.
      const syncAllPortfolios = createSyncAllPortfolios(ctx.db);
      const fn = createCreatePayment(ctx.db, {
        dedupWindowMs,
        onPaymentCreated: () => {
          void syncAllPortfolios();
        }
      });
      return fn(input);
    }),

  /**
   * Preview accrued mora (past-due fee) for a loan without recording a payment.
   * Collector/admin only (mikro/#73).
   */
  previewLateFee: collectorProcedure.input(previewLateFeeSchema).query(async ({ ctx, input }) => {
    const fn = createPreviewLateFee(ctx.db);
    return fn(input);
  }),

  /**
   * Reverse a payment. Collector/admin only (mikro/#73).
   */
  reversePayment: collectorProcedure
    .meta({ event: "payment.reversed" })
    .input(reversePaymentSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createReversePayment(ctx.db);
      return fn(input);
    }),

  /**
   * List all payments within a date range. Collector/admin only (mikro/#73).
   */
  listPayments: collectorProcedure.input(listPaymentsSchema).query(async ({ ctx, input }) => {
    const fn = createListPayments(ctx.db);
    return fn(input);
  }),

  /**
   * List payments for a specific customer's loans within a date range.
   * Collector/admin only — payment data must not be visible to REVIEWER
   * (mikro/#73).
   */
  listPaymentsByCustomer: collectorProcedure
    .input(listPaymentsByCustomerSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListPaymentsByCustomer(ctx.db);
      return fn(input);
    }),

  /**
   * List payments for a specific loan by numeric loan ID (e.g., 10000, 10001).
   * By default only shows COMPLETED payments unless showReversed is true.
   * Collector/admin only (mikro/#73).
   */
  listPaymentsByLoanId: collectorProcedure
    .input(listPaymentsByLoanIdSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListPaymentsByLoanId(ctx.db);
      return fn(input);
    }),

  // ==================== Receipt procedures ====================

  /**
   * Generate a receipt for a payment as a PNG image.
   * Returns base64-encoded PNG, JWT token, and receipt metadata.
   * Collector/admin only (mikro/#73).
   */
  generateReceipt: collectorProcedure
    .input(generateReceiptSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createGenerateReceipt({ db: ctx.db });
      return fn(input);
    }),

  /**
   * Generate a receipt from raw data (no database lookup).
   * Used by the CLI interactive mode so it doesn't need local assets/keys.
   */
  generateReceiptFromData: protectedProcedure
    .input(receiptDataSchema)
    .mutation(async ({ input }) => {
      const fn = createGenerateReceiptFromDataApi();
      return fn(input);
    }),

  /**
   * Send a receipt via WhatsApp to the collector (requestor).
   * Generates the receipt, saves it to disk, and sends it via WhatsApp.
   */
  sendReceiptViaWhatsApp: protectedProcedure
    .input(sendReceiptViaWhatsAppSchema)
    .mutation(async ({ ctx, input }) => {
      // Create WhatsApp client and sender
      const whatsAppClient = createWhatsAppClient();
      const sendWhatsAppMessage = createSendWhatsAppMessage(whatsAppClient);

      // Create receipt generator
      const generateReceipt = createGenerateReceipt({ db: ctx.db });

      // Create send receipt function
      const fn = createSendReceiptViaWhatsApp({
        db: ctx.db,
        generateReceipt,
        sendWhatsAppMessage,
        uploadMedia: whatsAppClient.uploadMedia.bind(whatsAppClient)
      });

      return fn(input);
    }),

  /**
   * Send the customer-facing payment confirmation: an approved WhatsApp template
   * with the landscape receipt card as the image header and a "Descargar recibo"
   * URL button to the public /r/:token verify page. Best-effort.
   */
  sendPaymentConfirmation: protectedProcedure
    .input(sendPaymentConfirmationSchema)
    .mutation(async ({ ctx, input }) => {
      const whatsAppClient = createWhatsAppClient();
      const { templateName, languageCode } = getWhatsAppPaymentConfirmationTemplate();

      // Card variant: the 1125×600 landscape receipt used as the template header.
      const generateReceiptCard = createGenerateReceipt({ db: ctx.db, variant: "card" });

      const fn = createSendPaymentConfirmation({
        generateReceiptCard,
        sendTemplateMessage: whatsAppClient.sendTemplateMessage.bind(whatsAppClient),
        templateName,
        languageCode,
        buildImageUrl: getReceiptImageUrl
      });

      return fn(input);
    }),

  // ==================== Report procedures ====================

  /**
   * Get portfolio metrics for a date range (for reports).
   */
  generatePortfolioMetrics: protectedProcedure
    .input(generatePortfolioMetricsSchema)
    .query(async ({ ctx, input }) => {
      const fn = createGeneratePortfolioMetrics(ctx.db);
      return fn(input);
    }),

  /**
   * Generate full performance report (metrics + LLM narrative + PNG).
   * Returns base64-encoded PNG image.
   */
  generatePerformanceReport: protectedProcedure
    .input(generatePerformanceReportSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createGeneratePerformanceReport(ctx.db);
      const result = await fn(input);
      return { image: result.image };
    }),

  /**
   * Generate the Modelo de negocio (projection model) PDF from the supplied
   * parameters. Stateless — no DB; returns the base64 PDF + filename.
   */
  generateModeloReport: protectedProcedure
    .input(generateModeloReportSchema)
    .mutation(async ({ input }) => {
      const fn = createGenerateModeloReport();
      return fn(input);
    }),

  /**
   * Generate at-risk loans report (PNG). Defaulted + red-highlighted late; optional filter.
   */
  generateDefaultedReport: protectedProcedure
    .input(generateDefaultedReportSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createGenerateDefaultedReport(ctx.db);
      const result = await fn(input);
      return { image: result.image };
    }),

  /**
   * Generate renewal candidates report (PNG). Near-completion and completed loans with rating and AI candidacy note.
   */
  generateRenewalCandidatesReport: protectedProcedure
    .input(generateRenewalCandidatesReportSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createGenerateRenewalCandidatesReport(ctx.db);
      const result = await fn(input);
      return { image: result.image };
    }),

  // ==================== Events / Feed procedures ====================
  //
  // Founder Dashboard surfaces: an append-only business-event feed, universal
  // search, deletion-snapshot restore, and month-scoped audit export. All
  // gated to ADMIN (founder === admin in v1). The feed deliberately uses
  // cursor pagination (see listFeedEventsSchema) rather than the repo's
  // offset/limit convention; search and export keep offset/limit.

  /**
   * Reverse-chronological business-event feed with opaque (occurredAt, id)
   * cursor pagination and optional type/date filters. ADMIN only.
   */
  listFeedEvents: adminProcedure.input(listFeedEventsSchema).query(async ({ ctx, input }) => {
    const fn = createListFeedEvents(ctx.db as unknown as PrismaClient);
    return fn(input);
  }),

  /**
   * Restore a hard-deleted application from its deletion-event snapshot within
   * the 30-day window; records an application.restored event. ADMIN only.
   */
  restoreApplication: adminProcedure
    .input(restoreApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createRestoreApplication(ctx.db as unknown as PrismaClient, ctx.userId);
      return fn(input);
    }),

  /**
   * Universal search across customers, loans, and feed events. ADMIN only.
   */
  searchAll: adminProcedure.input(searchAllSchema).query(async ({ ctx, input }) => {
    const fn = createSearchAll(ctx.db as unknown as PrismaClient);
    return fn(input);
  }),

  /**
   * Month-scoped CSV export of the event log (headers-only when empty). ADMIN only.
   */
  exportAuditLog: adminProcedure.input(exportAuditLogSchema).query(async ({ ctx, input }) => {
    const fn = createExportAuditLog(ctx.db as unknown as PrismaClient);
    return fn(input);
  }),

  // ==================== Copilot procedures ====================
  //
  // The founder copilot (design.md add-founder-copilot). All ADMIN-only. The
  // chat loop and confirm flow need the LLM model factory + tool executor built
  // at startup; those come from the copilot deps registry (setCopilotDeps),
  // keeping the static router thin and the model injectable for tests.

  /** Look up the caller's display name for provenance/event attribution. */
  copilotChat: adminProcedure.input(copilotChatSchema).mutation(async ({ ctx, input }) => {
    const db = ctx.db as unknown as PrismaClient;
    const { toolExecutor, createModel } = getCopilotDeps();
    const user = await db.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
    const fn = createCopilotChat({ db, toolExecutor, createModel });
    return fn({ userId: ctx.userId, actorName: user?.name, message: input.message });
  }),

  /** Confirm a pending copilot write: executes it and records copilot.action. */
  copilotConfirmAction: adminProcedure
    .input(copilotActionDecisionSchema)
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db as unknown as PrismaClient;
      const { toolExecutor } = getCopilotDeps();
      const user = await db.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
      const fn = createConfirmCopilotAction({ db, toolExecutor });
      return fn({ userId: ctx.userId, actorName: user?.name, actionId: input.actionId });
    }),

  /** Reject a pending copilot write: nothing executes. */
  copilotRejectAction: adminProcedure
    .input(copilotActionDecisionSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createRejectCopilotAction({ db: ctx.db as unknown as PrismaClient });
      return fn({ userId: ctx.userId, actionId: input.actionId });
    }),

  /** Copilot conversation history for the caller (copilot channel only). */
  getCopilotHistory: adminProcedure.input(getCopilotHistorySchema).query(async ({ ctx, input }) => {
    const fn = createGetCopilotHistory(ctx.db as unknown as PrismaClient);
    return fn({ userId: ctx.userId, limit: input.limit });
  }),

  /** List watch rules (active by default). */
  listWatchRules: adminProcedure.input(listWatchRulesSchema).query(async ({ ctx, input }) => {
    return listWatchRulesFn(ctx.db as unknown as PrismaClient, input);
  }),

  /** Enable or disable a watch rule. */
  setWatchRuleEnabled: adminProcedure
    .input(setWatchRuleEnabledSchema)
    .mutation(async ({ ctx, input }) => {
      return setWatchRuleEnabledFn(ctx.db as unknown as PrismaClient, input);
    }),

  // ==================== Accounting procedures ====================
  //
  // Self-contained, isolated from the rest of the system (only shares Basic/JWT auth).
  // Nested under `accounting.*` so clients call e.g. `client.accounting.createAccount.mutate()`.
  accounting: router({
    createAccount: protectedProcedure
      .input(createAccountSchema)
      .mutation(async ({ ctx, input }) => {
        const fn = createCreateAccount(ctx.db as unknown as PrismaClient);
        return fn(input);
      }),

    updateAccount: protectedProcedure
      .input(updateAccountSchema)
      .mutation(async ({ ctx, input }) => {
        const fn = createUpdateAccount(ctx.db as unknown as PrismaClient);
        return fn(input);
      }),

    listAccounts: protectedProcedure.input(listAccountsSchema).query(async ({ ctx, input }) => {
      const fn = createListAccounts(ctx.db as unknown as PrismaClient);
      return fn(input);
    }),

    getAccount: protectedProcedure.input(getAccountSchema).query(async ({ ctx, input }) => {
      const fn = createGetAccount(ctx.db as unknown as PrismaClient);
      return fn(input);
    }),

    createCategory: protectedProcedure
      .input(createCategorySchema)
      .mutation(async ({ ctx, input }) => {
        const fn = createCreateCategory(ctx.db as unknown as PrismaClient);
        return fn(input);
      }),

    listCategories: protectedProcedure.input(listCategoriesSchema).query(async ({ ctx, input }) => {
      const fn = createListCategories(ctx.db as unknown as PrismaClient);
      return fn(input);
    }),

    createTransaction: protectedProcedure
      .input(createTransactionSchema)
      .mutation(async ({ ctx, input }) => {
        const fn = createCreateTransaction(ctx.db as unknown as PrismaClient);
        return fn({ ...input, createdById: ctx.userId });
      }),

    reverseTransaction: protectedProcedure
      .input(reverseTransactionSchema)
      .mutation(async ({ ctx, input }) => {
        const fn = createReverseTransaction(ctx.db as unknown as PrismaClient);
        return fn({ ...input, createdById: ctx.userId });
      }),

    listTransactions: protectedProcedure
      .input(listTransactionsSchema)
      .query(async ({ ctx, input }) => {
        const fn = createListTransactions(ctx.db as unknown as PrismaClient);
        return fn(input);
      }),

    getTransaction: protectedProcedure.input(getTransactionSchema).query(async ({ ctx, input }) => {
      const fn = createGetTransaction(ctx.db as unknown as PrismaClient);
      return fn(input);
    }),

    getTransactionAttachment: protectedProcedure
      .input(getTransactionAttachmentSchema)
      .query(async ({ ctx, input }) => {
        const fn = createGetTransactionAttachment(ctx.db as unknown as PrismaClient);
        return fn(input);
      }),

    generateAccountingReport: protectedProcedure
      .input(generateAccountingReportSchema)
      .mutation(async ({ ctx, input }) => {
        const fn = createGenerateAccountingReport(ctx.db as unknown as PrismaClient);
        return fn(input);
      })
  })
});
