/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";

/**
 * Enum for payment methods.
 */
export const paymentMethodEnum = z.enum(["CASH", "TRANSFER"]);

/**
 * Enum for payment status.
 */
export const paymentStatusEnum = z.enum(["COMPLETED", "REVERSED", "PENDING"]);

/**
 * Schema for creating a new payment.
 * Uses numeric loanId (e.g., 10000, 10001) instead of UUID.
 */
export const createPaymentSchema = z.object({
  loanId: z.number().int().positive("Loan ID must be a positive integer"),
  amount: z.number().positive("Amount must be positive"),
  paidAt: z.coerce.date().optional(),
  method: paymentMethodEnum.optional(),
  collectedById: z.uuid({ error: "Invalid collector ID" }).optional(),
  notes: z.string().optional()
});

/**
 * Schema for reversing a payment.
 */
export const reversePaymentSchema = z.object({
  id: z.uuid({ error: "Invalid payment ID" }),
  notes: z.string().optional()
});

/**
 * Schema for listing payments with date range.
 * By default only shows COMPLETED payments unless showReversed is true.
 */
export const listPaymentsSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  showReversed: z.boolean().optional(), // If true, show all payments including reversed
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

/**
 * Schema for listing payments by member with date range.
 * By default only shows COMPLETED payments unless showReversed is true.
 */
export const listPaymentsByMemberSchema = z.object({
  memberId: z.uuid({ error: "Invalid member ID" }),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  showReversed: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

/**
 * Schema for listing payments by referrer with date range.
 * By default only shows COMPLETED payments unless showReversed is true.
 */
export const listPaymentsByReferrerSchema = z.object({
  referredById: z.uuid({ error: "Invalid referrer ID" }),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  showReversed: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

/**
 * Schema for listing payments by loan ID (numeric loanId, e.g., 10000, 10001).
 * By default only shows COMPLETED payments unless showReversed is true.
 */
export const listPaymentsByLoanIdSchema = z.object({
  loanId: z.number().int().positive("Loan ID must be a positive integer"),
  showReversed: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

/**
 * Input type for creating a payment.
 */
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

/**
 * Input type for reversing a payment.
 */
export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>;

/**
 * Input type for listing payments.
 */
export type ListPaymentsInput = z.infer<typeof listPaymentsSchema>;

/**
 * Input type for listing payments by member.
 */
export type ListPaymentsByMemberInput = z.infer<typeof listPaymentsByMemberSchema>;

/**
 * Input type for listing payments by referrer.
 */
export type ListPaymentsByReferrerInput = z.infer<typeof listPaymentsByReferrerSchema>;

/**
 * Input type for listing payments by loan ID.
 */
export type ListPaymentsByLoanIdInput = z.infer<typeof listPaymentsByLoanIdSchema>;

/**
 * Payment method enum type.
 */
export type PaymentMethod = z.infer<typeof paymentMethodEnum>;

/**
 * Payment status enum type.
 */
export type PaymentStatus = z.infer<typeof paymentStatusEnum>;
