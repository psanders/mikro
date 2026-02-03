/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  // Member schemas
  createMemberSchema,
  updateMemberSchema,
  getMemberSchema,
  listMembersSchema,
  listMembersByReferrerSchema,
  listMembersByCollectorSchema,
  exportCollectorMembersSchema,
  exportMembersByReferrerSchema,
  exportAllMembersSchema,
  // User schemas
  createUserSchema,
  updateUserSchema,
  getUserSchema,
  listUsersSchema,
  // Chat schemas
  getChatHistorySchema,
  // Loan schemas
  createLoanSchema,
  updateLoanStatusSchema,
  listLoansSchema,
  listLoansByReferrerSchema,
  listLoansByCollectorSchema,
  // Payment schemas
  createPaymentSchema,
  reversePaymentSchema,
  listPaymentsSchema,
  listPaymentsByMemberSchema,
  listPaymentsByReferrerSchema,
  listPaymentsByLoanIdSchema,
  // Receipt schemas
  generateReceiptSchema,
  sendReceiptViaWhatsAppSchema
} from "@mikro/common";
import { router, protectedProcedure } from "../trpc.js";
// Member API functions
import { createCreateMember } from "../../api/members/createCreateMember.js";
import { createUpdateMember } from "../../api/members/createUpdateMember.js";
import { createGetMember } from "../../api/members/createGetMember.js";
import { createListMembers } from "../../api/members/createListMembers.js";
import { createListMembersByReferrer } from "../../api/members/createListMembersByReferrer.js";
import { createListMembersByCollector } from "../../api/members/createListMembersByCollector.js";
import { createExportCollectorMembers } from "../../api/members/createExportCollectorMembers.js";
import { createExportMembersByReferrer } from "../../api/members/createExportMembersByReferrer.js";
import { createExportAllMembers } from "../../api/members/createExportAllMembers.js";
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
import { createListLoans } from "../../api/loans/createListLoans.js";
import { createListLoansByReferrer } from "../../api/loans/createListLoansByReferrer.js";
import { createListLoansByCollector } from "../../api/loans/createListLoansByCollector.js";
// Payment API functions
import { createCreatePayment } from "../../api/payments/createCreatePayment.js";
import { createReversePayment } from "../../api/payments/createReversePayment.js";
import { createListPayments } from "../../api/payments/createListPayments.js";
import { createListPaymentsByMember } from "../../api/payments/createListPaymentsByMember.js";
import { createListPaymentsByReferrer } from "../../api/payments/createListPaymentsByReferrer.js";
import { createListPaymentsByLoanId } from "../../api/payments/createListPaymentsByLoanId.js";
// Receipt API functions
import { createGenerateReceipt } from "../../api/receipts/createGenerateReceipt.js";
import { createSendReceiptViaWhatsApp } from "../../api/receipts/createSendReceiptViaWhatsApp.js";
// WhatsApp functions
import { createSendWhatsAppMessage, createWhatsAppClient } from "@mikro/agents";

/**
 * Protected router - procedures that require Basic Auth.
 */
export const protectedRouter = router({
  // ==================== Member procedures ====================

  /**
   * Create a new member.
   */
  createMember: protectedProcedure.input(createMemberSchema).mutation(async ({ ctx, input }) => {
    const fn = createCreateMember(ctx.db);
    return fn(input);
  }),

  /**
   * Update an existing member.
   */
  updateMember: protectedProcedure.input(updateMemberSchema).mutation(async ({ ctx, input }) => {
    const fn = createUpdateMember(ctx.db);
    return fn(input);
  }),

  /**
   * Get a member by ID.
   */
  getMember: protectedProcedure.input(getMemberSchema).query(async ({ ctx, input }) => {
    const fn = createGetMember(ctx.db);
    return fn(input);
  }),

  /**
   * List all members with optional pagination.
   */
  listMembers: protectedProcedure.input(listMembersSchema).query(async ({ ctx, input }) => {
    const fn = createListMembers(ctx.db);
    return fn(input);
  }),

  /**
   * List members by referrer ID.
   */
  listMembersByReferrer: protectedProcedure
    .input(listMembersByReferrerSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListMembersByReferrer(ctx.db);
      return fn(input);
    }),

  /**
   * List members by collector ID.
   */
  listMembersByCollector: protectedProcedure
    .input(listMembersByCollectorSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListMembersByCollector(ctx.db);
      return fn(input);
    }),

  /**
   * Export members by collector ID with loans and referrer for report generation.
   * Returns members with active loans, payment status, and referrer info.
   */
  exportCollectorMembers: protectedProcedure
    .input(exportCollectorMembersSchema)
    .query(async ({ ctx, input }) => {
      const fn = createExportCollectorMembers(ctx.db);
      return fn(input);
    }),

  /**
   * Export members by referrer ID with loans and referrer for report generation.
   * Returns members referred by a specific user with active loans and payment status.
   */
  exportMembersByReferrer: protectedProcedure
    .input(exportMembersByReferrerSchema)
    .query(async ({ ctx, input }) => {
      const fn = createExportMembersByReferrer(ctx.db);
      return fn(input);
    }),

  /**
   * Export all active members with loans and referrer for report generation.
   * Admin-only operation that returns all members with active loans and payment status.
   */
  exportAllMembers: protectedProcedure.input(exportAllMembersSchema).query(async ({ ctx }) => {
    const fn = createExportAllMembers(ctx.db);
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
   * Get chat history for a member or user.
   */
  getChatHistory: protectedProcedure.input(getChatHistorySchema).query(async ({ ctx, input }) => {
    const fn = createGetChatHistory(ctx.db);
    return fn(input);
  }),

  // ==================== Loan procedures ====================

  /**
   * Create a new loan for a member.
   */
  createLoan: protectedProcedure.input(createLoanSchema).mutation(async ({ ctx, input }) => {
    const fn = createCreateLoan(ctx.db);
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
   * List loans for members referred by a specific user.
   */
  listLoansByReferrer: protectedProcedure
    .input(listLoansByReferrerSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListLoansByReferrer(ctx.db);
      return fn(input);
    }),

  /**
   * List loans for members assigned to a specific collector.
   */
  listLoansByCollector: protectedProcedure
    .input(listLoansByCollectorSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListLoansByCollector(ctx.db);
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
   * List payments for a specific member's loans within a date range.
   */
  listPaymentsByMember: protectedProcedure
    .input(listPaymentsByMemberSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListPaymentsByMember(ctx.db);
      return fn(input);
    }),

  /**
   * List payments for all members referred by a specific user within a date range.
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
    })
});
