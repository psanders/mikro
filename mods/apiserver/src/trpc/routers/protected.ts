/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  // Customer schemas
  createCustomerSchema,
  updateCustomerSchema,
  getCustomerSchema,
  listCustomersSchema,
  listCustomersByReferrerSchema,
  listCustomersByCollectorSchema,
  exportCollectorCustomersSchema,
  exportCustomersByReferrerSchema,
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
  listLoansByReferrerSchema,
  listLoansByCollectorSchema,
  listLoansByCustomerSchema,
  // Payment schemas
  createPaymentSchema,
  reversePaymentSchema,
  listPaymentsSchema,
  listPaymentsByCustomerSchema,
  listPaymentsByReferrerSchema,
  listPaymentsByLoanIdSchema,
  // Receipt schemas
  generateReceiptSchema,
  receiptDataSchema,
  sendReceiptViaWhatsAppSchema,
  // Report schemas
  generatePortfolioMetricsSchema,
  generatePerformanceReportSchema,
  generateDefaultedReportSchema,
  // Loan note schemas
  createLoanNoteSchema,
  listLoanNotesByLoanSchema,
  // Collection schemas
  runCollectionsSchema,
  runSingleCollectionSchema
} from "@mikro/common";
import { router, protectedProcedure } from "../trpc.js";
// Customer API functions
import { createCreateCustomer } from "../../api/customers/createCreateCustomer.js";
import { createUpdateCustomer } from "../../api/customers/createUpdateCustomer.js";
import { createGetCustomer } from "../../api/customers/createGetCustomer.js";
import { createListCustomers } from "../../api/customers/createListCustomers.js";
import { createListCustomersByReferrer } from "../../api/customers/createListCustomersByReferrer.js";
import { createListCustomersByCollector } from "../../api/customers/createListCustomersByCollector.js";
import { createExportCollectorCustomers } from "../../api/customers/createExportCollectorCustomers.js";
import { createExportCustomersByReferrer } from "../../api/customers/createExportCustomersByReferrer.js";
import { createExportAllCustomers } from "../../api/customers/createExportAllCustomers.js";
// User API functions
import { createCreateUser } from "../../api/users/createCreateUser.js";
import { createUpdateUser } from "../../api/users/createUpdateUser.js";
import { createGetUser } from "../../api/users/createGetUser.js";
import { createListUsers } from "../../api/users/createListUsers.js";
// Chat API functions
import { createGetChatHistory } from "../../api/chat/createGetChatHistory.js";
// Loan API functions
import { createCreateLoan } from "../../api/loans/createCreateLoan.js";
import { createUpdateLoanStatus } from "../../api/loans/createUpdateLoanStatus.js";
import { createUpdateLoanNickname } from "../../api/loans/createUpdateLoanNickname.js";
import { createListLoans } from "../../api/loans/createListLoans.js";
import { createListLoansByReferrer } from "../../api/loans/createListLoansByReferrer.js";
import { createListLoansByCollector } from "../../api/loans/createListLoansByCollector.js";
import { createListLoansByCustomer } from "../../api/loans/createListLoansByCustomer.js";
import { createCalculateLoan } from "../../api/loans/createCalculateLoan.js";
// Payment API functions
import { createCreatePayment } from "../../api/payments/createCreatePayment.js";
import { createReversePayment } from "../../api/payments/createReversePayment.js";
import { createListPayments } from "../../api/payments/createListPayments.js";
import { createListPaymentsByCustomer } from "../../api/payments/createListPaymentsByCustomer.js";
import { createListPaymentsByReferrer } from "../../api/payments/createListPaymentsByReferrer.js";
import { createListPaymentsByLoanId } from "../../api/payments/createListPaymentsByLoanId.js";
// Receipt API functions
import { createGenerateReceipt } from "../../api/receipts/createGenerateReceipt.js";
import { createGenerateReceiptFromDataApi } from "../../api/receipts/createGenerateReceiptFromData.js";
import { createSendReceiptViaWhatsApp } from "../../api/receipts/createSendReceiptViaWhatsApp.js";
// Report API functions
import { createGeneratePortfolioMetrics } from "../../api/reports/createGeneratePortfolioMetrics.js";
import { createGeneratePerformanceReport } from "../../api/reports/createGeneratePerformanceReport.js";
import { createGenerateDefaultedReport } from "../../api/reports/createGenerateDefaultedReport.js";
// Loan note API functions
import { createCreateLoanNote } from "../../api/loanNotes/createCreateLoanNote.js";
import { createListLoanNotesByLoan } from "../../api/loanNotes/createListLoanNotesByLoan.js";
// WhatsApp functions
import { createSendWhatsAppMessage, createWhatsAppClient } from "@mikro/agents";
// Collections
import {
  runDailyCollections,
  runSingleCollection,
  setDryRunOverride
} from "../../collections/index.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

/**
 * Protected router - procedures that require Basic Auth.
 */
export const protectedRouter = router({
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
   * List customers by referrer ID.
   */
  listCustomersByReferrer: protectedProcedure
    .input(listCustomersByReferrerSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListCustomersByReferrer(ctx.db);
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
   * Export customers by collector ID with loans and referrer for report generation.
   * Returns customers with active loans, payment status, and referrer info.
   */
  exportCollectorCustomers: protectedProcedure
    .input(exportCollectorCustomersSchema)
    .query(async ({ ctx, input }) => {
      const fn = createExportCollectorCustomers(ctx.db);
      return fn(input);
    }),

  /**
   * Export customers by referrer ID with loans and referrer for report generation.
   * Returns customers referred by a specific user with active loans and payment status.
   */
  exportCustomersByReferrer: protectedProcedure
    .input(exportCustomersByReferrerSchema)
    .query(async ({ ctx, input }) => {
      const fn = createExportCustomersByReferrer(ctx.db);
      return fn(input);
    }),

  /**
   * Export all active customers with loans and referrer for report generation.
   * Admin-only operation that returns all customers with active loans and payment status.
   */
  exportAllCustomers: protectedProcedure.input(exportAllCustomersSchema).query(async ({ ctx }) => {
    const fn = createExportAllCustomers(ctx.db);
    return fn({});
  }),

  // ==================== User procedures ====================

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
   * List loans for customers referred by a specific user.
   */
  listLoansByReferrer: protectedProcedure
    .input(listLoansByReferrerSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListLoansByReferrer(ctx.db);
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

  // ==================== Payment procedures ====================

  /**
   * Create a new payment for a loan.
   */
  createPayment: protectedProcedure.input(createPaymentSchema).mutation(async ({ ctx, input }) => {
    const fn = createCreatePayment(ctx.db);
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
   * List payments for all customers referred by a specific user within a date range.
   */
  listPaymentsByReferrer: protectedProcedure
    .input(listPaymentsByReferrerSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListPaymentsByReferrer(ctx.db);
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
   * Generate at-risk loans report (PNG). Defaulted + red-highlighted late; optional filter.
   */
  generateDefaultedReport: protectedProcedure
    .input(generateDefaultedReportSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createGenerateDefaultedReport(ctx.db);
      const result = await fn(input);
      return { image: result.image };
    }),

  // ==================== Collection procedures ====================

  /**
   * Trigger the daily collections process on demand.
   * Evaluates all active customers and sends reminders, overdue notices, or collection calls
   * based on their payment status. Supports dry-run mode.
   */
  runCollections: protectedProcedure
    .input(runCollectionsSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.dryRun) {
        setDryRunOverride(true);
      }

      try {
        const whatsAppClient = createWhatsAppClient();
        await runDailyCollections(
          new Date(),
          {
            db: ctx.db as unknown as PrismaClient,
            sendWhatsAppTemplate: (p) =>
              whatsAppClient.sendTemplateMessage({
                ...p,
                headerParameters: p.headerParameters ?? [],
                bodyParameters: p.bodyParameters ?? []
              })
          },
          input.includeDefaulted,
          input.appRef
        );
      } finally {
        if (input.dryRun) {
          setDryRunOverride(undefined);
        }
      }

      return { success: true, dryRun: input.dryRun };
    }),

  /**
   * Run a single collection action (reminder, overdue notice, or call) for one loan.
   * Optionally force channel and/or type; otherwise auto-determined from missed payments.
   */
  runSingleCollection: protectedProcedure
    .input(runSingleCollectionSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.dryRun) {
        setDryRunOverride(true);
      }

      try {
        const whatsAppClient = createWhatsAppClient();
        const result = await runSingleCollection(
          {
            loanId: input.loanId,
            channel: input.channel ?? undefined,
            type: input.type ?? undefined,
            dryRun: input.dryRun,
            includeDefaulted: input.includeDefaulted,
            appRef: input.appRef
          },
          {
            db: ctx.db as unknown as PrismaClient,
            sendWhatsAppTemplate: (p) =>
              whatsAppClient.sendTemplateMessage({
                ...p,
                headerParameters: p.headerParameters ?? [],
                bodyParameters: p.bodyParameters ?? []
              })
          }
        );
        return result;
      } finally {
        if (input.dryRun) {
          setDryRunOverride(undefined);
        }
      }
    })
});
