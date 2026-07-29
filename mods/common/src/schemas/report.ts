/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";
import { safeOptionalDate } from "./dates.js";

/** Shared JSON/PDF format flag every migrated report input carries. */
const reportFormatSchema = z.enum(["json", "pdf"]).default("pdf").optional();

/**
 * Schema for generating the performance-trend report ("Desempeño en el
 * Tiempo"). `endDate` is the as-of end of the window (defaults to now);
 * `months` is how many trailing monthly snapshots to compute (default 12).
 */
export const generatePerformanceTrendReportSchema = z.object({
  endDate: safeOptionalDate,
  months: z.number().int().min(2).max(24).default(12).optional(),
  format: reportFormatSchema
});

export type GeneratePerformanceTrendReportInput = z.infer<
  typeof generatePerformanceTrendReportSchema
>;

/**
 * Schema for generating the at-risk loans report (defaulted + red-highlighted late).
 * Optional filter: "all" (default), "defaulted", or "late".
 */
export const generateDefaultedReportSchema = z.object({
  filter: z.enum(["all", "defaulted", "late"]).default("all").optional(),
  format: reportFormatSchema
});

export type GenerateDefaultedReportInput = z.infer<typeof generateDefaultedReportSchema>;

/**
 * Schema for generating the renewal candidates report (near completion + completed loans, rating, AI candidacy note).
 */
export const generateRenewalCandidatesReportSchema = z.object({
  format: reportFormatSchema
});

export type GenerateRenewalCandidatesReportInput = z.infer<
  typeof generateRenewalCandidatesReportSchema
>;

/**
 * Schema for generating the accounting snapshot report.
 * Optional date range; defaults to month-to-date on the server.
 */
export const generateAccountingReportSchema = z.object({
  startDate: safeOptionalDate,
  endDate: safeOptionalDate,
  format: reportFormatSchema
});

export type GenerateAccountingReportInput = z.infer<typeof generateAccountingReportSchema>;

/**
 * Schema for generating the customers report (health-grouped active loans:
 * Crítico / Requiere atención / Al día). No filters — mirrors the
 * pre-migration `exportAllCustomers` scope (all active customers); a
 * collector-scoped variant is not part of this migration.
 */
export const generateCustomersReportSchema = z.object({
  format: reportFormatSchema
});

export type GenerateCustomersReportInput = z.infer<typeof generateCustomersReportSchema>;

/**
 * Schema for generating the loan-statement report (issue #161 / #110). Just the
 * loan id + desired output — the apiserver resolves the loan, maps it into the
 * report's DB-free snapshot input, and runs the shared `loanStatementReport`
 * definition. Shared by the tRPC procedure, the CLI command, and the
 * `loan-statement` automation's ask slot, so the three surfaces validate the
 * same contract.
 */
export const generateLoanStatementSchema = z.object({
  loanId: z.number().int().positive("Loan ID must be a positive integer"),
  format: z.enum(["json", "pdf"]).default("pdf").optional()
});

export type GenerateLoanStatementInput = z.infer<typeof generateLoanStatementSchema>;
