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
export const paymentFrequencyEnum = z.enum(["DAILY", "WEEKLY"]);

/**
 * Schema for creating a new loan.
 */
export const createLoanSchema = z.object({
  memberId: z.uuid({ error: "Invalid member ID" }),
  principal: z.number().positive("Principal must be positive"),
  termLength: z.number().int().positive("Term length must be a positive integer"),
  paymentAmount: z.number().positive("Payment amount must be positive"),
  paymentFrequency: paymentFrequencyEnum,
  type: loanTypeEnum.optional()
});

/**
 * Schema for getting a loan by ID.
 */
export const getLoanSchema = z.object({
  id: z.uuid({ error: "Invalid loan ID" })
});

/**
 * Enum for loan status.
 */
export const loanStatusEnum = z.enum(["ACTIVE", "COMPLETED", "DEFAULTED", "CANCELLED"]);

/**
 * Schema for listing loans with optional pagination and status filter.
 */
export const listLoansSchema = z.object({
  showAll: z.boolean().optional(), // If true, show all statuses; otherwise only ACTIVE
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

/**
 * Schema for listing loans by referrer (members referred by a user).
 */
export const listLoansByReferrerSchema = z.object({
  referredById: z.uuid({ error: "Invalid referrer ID" }),
  showAll: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

/**
 * Schema for listing loans by collector (members assigned to a collector).
 */
export const listLoansByCollectorSchema = z.object({
  assignedCollectorId: z.uuid({ error: "Invalid collector ID" }),
  showAll: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

/**
 * Schema for listing loans by member ID.
 */
export const listLoansByMemberSchema = z.object({
  memberId: z.uuid({ error: "Invalid member ID" }),
  showAll: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

/**
 * Input type for creating a loan.
 */
export type CreateLoanInput = z.infer<typeof createLoanSchema>;

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
 * Input type for listing loans by member.
 */
export type ListLoansByMemberInput = z.infer<typeof listLoansByMemberSchema>;

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
