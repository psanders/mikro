/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
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
  generateApplicationSummarySchema
} from "@mikro/common";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, reviewerProcedure } from "../trpc.js";
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
import { createReversePayment } from "../../api/payments/createReversePayment.js";
import { createListPayments } from "../../api/payments/createListPayments.js";
import { createListPaymentsByCustomer } from "../../api/payments/createListPaymentsByCustomer.js";
import { createListPaymentsByLoanId } from "../../api/payments/createListPaymentsByLoanId.js";
import { createPreviewLateFee } from "../../api/payments/createPreviewLateFee.js";
// Receipt API functions
import { createGenerateReceipt } from "../../api/receipts/createGenerateReceipt.js";
import { createGenerateReceiptFromDataApi } from "../../api/receipts/createGenerateReceiptFromData.js";
import { createSendReceiptViaWhatsApp } from "../../api/receipts/createSendReceiptViaWhatsApp.js";
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
  getWhatsAppPromoTemplate
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
  getTransactionAttachmentSchema
} from "@mikro/common";
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
    return fn({ collectorId: ctx.userId });
  }),

  // ==================== Customer procedures ====================

  /**
   * Create a new customer.
   */
  createCustomer: protectedProcedure
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
   * Claim a RECEIVED application for review (-> IN_REVIEW). ADMIN/REVIEWER only.
   */
  claimApplication: reviewerProcedure
    .input(claimApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createClaimApplication(ctx.db);
      return fn(input, ctx.userId);
    }),

  /**
   * Approve an application (RECEIVED|IN_REVIEW -> APPROVED). ADMIN/REVIEWER only.
   */
  approveApplication: reviewerProcedure
    .input(approveApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createApproveApplication(ctx.db);
      return fn(input, ctx.userId);
    }),

  /**
   * Reject an application with a reason (RECEIVED|IN_REVIEW -> REJECTED). ADMIN/REVIEWER only.
   */
  rejectApplication: reviewerProcedure
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
        const { templateName, languageCode } = getWhatsAppPromoTemplate();
        const sendPromo = createSendApplicationPromo({
          sendTemplateMessage: whatsAppClient.sendTemplateMessage.bind(whatsAppClient),
          templateName,
          languageCode
        });
        promo = await sendPromo(application.phone);
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

  // ==================== Payment procedures ====================

  /**
   * Create a new payment for a loan.
   */
  createPayment: protectedProcedure.input(createPaymentSchema).mutation(async ({ ctx, input }) => {
    // Block collectors from double-charging the same customer within 5 minutes.
    // Admins (e.g. CTL back-office) bypass the guard.
    const isAdmin = ctx.roles.includes("ADMIN");
    const isCollector = ctx.roles.includes("COLLECTOR");
    const dedupWindowMs = isCollector && !isAdmin ? 5 * 60 * 1000 : undefined;
    const fn = createCreatePayment(ctx.db, { dedupWindowMs });
    return fn(input);
  }),

  /**
   * Preview accrued mora (past-due fee) for a loan without recording a payment.
   */
  previewLateFee: protectedProcedure.input(previewLateFeeSchema).query(async ({ ctx, input }) => {
    const fn = createPreviewLateFee(ctx.db);
    return fn(input);
  }),

  /**
   * Reverse a payment.
   */
  reversePayment: protectedProcedure
    .input(reversePaymentSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createReversePayment(ctx.db);
      return fn(input);
    }),

  /**
   * List all payments within a date range.
   */
  listPayments: protectedProcedure.input(listPaymentsSchema).query(async ({ ctx, input }) => {
    const fn = createListPayments(ctx.db);
    return fn(input);
  }),

  /**
   * List payments for a specific customer's loans within a date range.
   */
  listPaymentsByCustomer: protectedProcedure
    .input(listPaymentsByCustomerSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListPaymentsByCustomer(ctx.db);
      return fn(input);
    }),

  /**
   * List payments for a specific loan by numeric loan ID (e.g., 10000, 10001).
   * By default only shows COMPLETED payments unless showReversed is true.
   */
  listPaymentsByLoanId: protectedProcedure
    .input(listPaymentsByLoanIdSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListPaymentsByLoanId(ctx.db);
      return fn(input);
    }),

  // ==================== Receipt procedures ====================

  /**
   * Generate a receipt for a payment as a PNG image.
   * Returns base64-encoded PNG, JWT token, and receipt metadata.
   */
  generateReceipt: protectedProcedure
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
