/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";
import { safeOptionalDate } from "./dates.js";

/**
 * Schema for generating a performance report.
 * Optional date range; defaults to current month on the server.
 */
export const generatePerformanceReportSchema = z.object({
  startDate: safeOptionalDate,
  endDate: safeOptionalDate
});

export type GeneratePerformanceReportInput = z.infer<typeof generatePerformanceReportSchema>;

/**
 * Schema for portfolio metrics query (same date semantics as report).
 */
export const generatePortfolioMetricsSchema = z.object({
  startDate: safeOptionalDate,
  endDate: safeOptionalDate
});

export type GeneratePortfolioMetricsInput = z.infer<typeof generatePortfolioMetricsSchema>;

/**
 * Schema for generating the at-risk loans report (defaulted + red-highlighted late).
 * Optional filter: "all" (default), "defaulted", or "late".
 */
export const generateDefaultedReportSchema = z.object({
  filter: z.enum(["all", "defaulted", "late"]).default("all").optional()
});

export type GenerateDefaultedReportInput = z.infer<typeof generateDefaultedReportSchema>;

/**
 * Schema for generating the renewal candidates report (near completion + completed loans, rating, AI candidacy note).
 */
export const generateRenewalCandidatesReportSchema = z.object({});

export type GenerateRenewalCandidatesReportInput = z.infer<
  typeof generateRenewalCandidatesReportSchema
>;

/** Collection attempt types stored in DB (for audit filter). */
export const collectionAttemptTypeEnum = z.enum([
  "PAYMENT_CONFIRMATION",
  "PAYMENT_REMINDER",
  "OVERDUE_NOTICE",
  "COLLECTION_CALL"
]);

/** Collection attempt status (for audit filter). */
export const collectionAttemptStatusEnum = z.enum(["SENT", "FAILED"]);

/**
 * Schema for the daily collections audit report.
 * Lists which notifications were sent for a given day (default: today).
 */
export const generateCollectionsAuditReportSchema = z.object({
  /** Audit date; defaults to today on the server if omitted. */
  date: safeOptionalDate,
  /** Optional filter by attempt type(s). Omit to include all types. */
  attemptTypes: z.array(collectionAttemptTypeEnum).optional(),
  /** Optional filter by status(es). Omit to include SENT and FAILED. */
  statuses: z.array(collectionAttemptStatusEnum).optional()
});

export type GenerateCollectionsAuditReportInput = z.infer<
  typeof generateCollectionsAuditReportSchema
>;

/**
 * Schema for generating the accounting snapshot report.
 * Optional date range; defaults to month-to-date on the server.
 */
export const generateAccountingReportSchema = z.object({
  startDate: safeOptionalDate,
  endDate: safeOptionalDate
});

export type GenerateAccountingReportInput = z.infer<typeof generateAccountingReportSchema>;
