/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";

/**
 * Schema for generating a performance report.
 * Optional date range; defaults to current month on the server.
 */
export const generatePerformanceReportSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional()
});

export type GeneratePerformanceReportInput = z.infer<typeof generatePerformanceReportSchema>;

/**
 * Schema for portfolio metrics query (same date semantics as report).
 */
export const generatePortfolioMetricsSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional()
});

export type GeneratePortfolioMetricsInput = z.infer<typeof generatePortfolioMetricsSchema>;
