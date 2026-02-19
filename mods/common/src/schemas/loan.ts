/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";

/**
 * Enum for loan types.
 */
export const loanTypeEnum = z.enum(["SAN"]);

/**
 * Enum for payment frequency.
 */
export const paymentFrequencyEnum = z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]);

/**
 * Schema for creating a new loan.
 */
export const createLoanSchema = z.object({
  customerId: z.uuid({ error: "Invalid customer ID" }),
  principal: z.number().positive("Principal must be positive"),
  termLength: z.number().int().positive("Term length must be a positive integer"),
  paymentAmount: z.number().positive("Payment amount must be positive"),
  paymentFrequency: paymentFrequencyEnum,
  startingDate: z.coerce.date().optional(),
  nickname: z.string().max(100).optional(),
  type: loanTypeEnum.optional()
});

/**
 * Schema for calculating loan options using a base rate and per-period adjustment.
 */
export const calculateLoanSchema = z.object({
  principal: z.number().positive("Principal must be positive"),
  interestRate: z
    .number()
    .positive("Interest rate must be positive")
    .max(1, "Interest rate must be less than or equal to 1 (e.g., 0.30 for 30%)"),
  paymentFrequency: paymentFrequencyEnum,
  baseDuration: z.number().int().positive("Base duration must be a positive integer"),
  adjustmentPerPeriod: z.number().positive("Adjustment per period must be positive").optional(),
  minRate: z.number().min(0, "Minimum rate cannot be negative").max(1).optional(),
  maxRate: z.number().min(0).max(1, "Maximum rate must be less than or equal to 1").optional(),
  optionsRange: z.number().int().positive("Options range must be a positive integer").optional()
});

/**
 * Schema for getting a loan by ID.
 */
export const getLoanSchema = z.object({
  id: z.uuid({ error: "Invalid loan ID" })
});

/**
 * Schema for getting a loan by numeric loan ID.
 */
export const getLoanByLoanIdSchema = z.object({
  loanId: z.number().int().positive("Loan ID must be a positive integer")
});

/**
 * Enum for loan status.
 */
export const loanStatusEnum = z.enum(["ACTIVE", "COMPLETED", "DEFAULTED", "CANCELLED"]);

/**
 * Terminal statuses only (for updateLoanStatus). ACTIVE cannot be set via this endpoint.
 */
export const updateLoanStatusStatusEnum = z.enum(["COMPLETED", "DEFAULTED", "CANCELLED"]);

/**
 * Schema for updating a loan's status.
 */
export const updateLoanStatusSchema = z.object({
  loanId: z.number().int().positive("Loan ID must be a positive integer"),
  status: updateLoanStatusStatusEnum
});

/**
 * Schema for updating a loan's nickname (set or clear).
 */
export const updateLoanNicknameSchema = z.object({
  loanId: z.number().int().positive("Loan ID must be a positive integer"),
  nickname: z.string().max(100).nullable()
});

/**
 * Schema for listing loans with optional pagination and status filter.
 */
export const listLoansSchema = z.object({
  showAll: z.boolean().optional(), // If true, show all statuses; otherwise only ACTIVE
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

/**
 * Schema for listing loans by referrer (customers referred by a user).
 */
export const listLoansByReferrerSchema = z.object({
  referredById: z.uuid({ error: "Invalid referrer ID" }),
  showAll: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

/**
 * Schema for listing loans by collector (customers assigned to a collector).
 */
export const listLoansByCollectorSchema = z.object({
  assignedCollectorId: z.uuid({ error: "Invalid collector ID" }),
  showAll: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

/**
 * Schema for listing loans by customer ID.
 */
export const listLoansByCustomerSchema = z.object({
  customerId: z.uuid({ error: "Invalid customer ID" }),
  showAll: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

/**
 * Input type for creating a loan.
 */
export type CreateLoanInput = z.infer<typeof createLoanSchema>;

/**
 * Input type for calculating loan options.
 */
export type CalculateLoanInput = z.infer<typeof calculateLoanSchema>;

/**
 * Input type for getting a loan.
 */
export type GetLoanInput = z.infer<typeof getLoanSchema>;

/**
 * Input type for listing loans.
 */
export type ListLoansInput = z.infer<typeof listLoansSchema>;

/**
 * Input type for listing loans by referrer.
 */
export type ListLoansByReferrerInput = z.infer<typeof listLoansByReferrerSchema>;

/**
 * Input type for listing loans by collector.
 */
export type ListLoansByCollectorInput = z.infer<typeof listLoansByCollectorSchema>;

/**
 * Input type for listing loans by customer.
 */
export type ListLoansByCustomerInput = z.infer<typeof listLoansByCustomerSchema>;

/**
 * Input type for getting a loan by numeric loan ID.
 */
export type GetLoanByLoanIdInput = z.infer<typeof getLoanByLoanIdSchema>;

/**
 * Input type for updating a loan's status.
 */
export type UpdateLoanStatusInput = z.infer<typeof updateLoanStatusSchema>;

/**
 * Input type for updating a loan's nickname.
 */
export type UpdateLoanNicknameInput = z.infer<typeof updateLoanNicknameSchema>;

/**
 * Loan type enum type.
 */
export type LoanType = z.infer<typeof loanTypeEnum>;

/**
 * Loan status enum type.
 */
export type LoanStatus = z.infer<typeof loanStatusEnum>;

/**
 * Payment frequency enum type.
 */
export type PaymentFrequency = z.infer<typeof paymentFrequencyEnum>;
