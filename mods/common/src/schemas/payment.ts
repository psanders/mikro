/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";

export const paymentMethodEnum = z.enum(["CASH", "TRANSFER"]);

export const paymentStatusEnum = z.enum(["COMPLETED", "PARTIAL", "REVERSED", "PENDING"]);

export const paymentKindEnum = z.enum(["INSTALLMENT", "LATE_FEE"]);

/**
 * Schema for creating a new payment.
 * Uses numeric loanId (e.g., 10000, 10001) instead of UUID.
 * By default the server splits `amount` mora-first into LATE_FEE + INSTALLMENT rows when mora is owed.
 */
export const createPaymentSchema = z.object({
  loanId: z.number().int().positive("Loan ID must be a positive integer"),
  amount: z.number().positive("Amount must be positive"),
  paidAt: z.coerce.date().optional(),
  method: paymentMethodEnum.optional(),
  collectedById: z.uuid({ message: "Collector ID is required and must be a valid UUID" }),
  notes: z.string().optional(),
  /** When set, overrides auto-classification of COMPLETED vs PARTIAL (amount vs loan.paymentAmount) on the INSTALLMENT row only. */
  status: z.enum(["COMPLETED", "PARTIAL"]).optional(),
  /**
   * When set, record a single row of this kind (no auto-split).
   * Use LATE_FEE for mora-only collection; INSTALLMENT to skip mora allocation for this payment.
   */
  kind: paymentKindEnum.optional(),
  /**
   * Reduces accrued mora used for split (waive part of mora). Does not apply when `kind` is set.
   */
  lateFeeOverride: z.number().min(0, "lateFeeOverride must be non-negative").optional()
});

/**
 * Preview accrued mora for a loan (numeric loanId).
 */
export const previewLateFeeSchema = z.object({
  loanId: z.number().int().positive("Loan ID must be a positive integer"),
  asOf: z.coerce.date().optional()
});

export const reversePaymentSchema = z.object({
  id: z.uuid({ error: "Invalid payment ID" }),
  notes: z.string().optional()
});

export const listPaymentsSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  showReversed: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

export const listPaymentsByCustomerSchema = z.object({
  customerId: z.uuid({ error: "Invalid customer ID" }),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  showReversed: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

export const listPaymentsByReferrerSchema = z.object({
  referredById: z.uuid({ error: "Invalid referrer ID" }),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  showReversed: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

export const listPaymentsByLoanIdSchema = z.object({
  loanId: z.number().int().positive("Loan ID must be a positive integer"),
  showReversed: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type PreviewLateFeeInput = z.infer<typeof previewLateFeeSchema>;
export type PaymentKind = z.infer<typeof paymentKindEnum>;
export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>;
export type ListPaymentsInput = z.infer<typeof listPaymentsSchema>;
export type ListPaymentsByCustomerInput = z.infer<typeof listPaymentsByCustomerSchema>;
export type ListPaymentsByReferrerInput = z.infer<typeof listPaymentsByReferrerSchema>;
export type ListPaymentsByLoanIdInput = z.infer<typeof listPaymentsByLoanIdSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodEnum>;
export type PaymentStatus = z.infer<typeof paymentStatusEnum>;
