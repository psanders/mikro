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

/**
 * Schema for generating the accounting snapshot report.
 * Optional date range; defaults to month-to-date on the server.
 */
export const generateAccountingReportSchema = z.object({
  startDate: safeOptionalDate,
  endDate: safeOptionalDate
});

export type GenerateAccountingReportInput = z.infer<typeof generateAccountingReportSchema>;

/**
 * Schema for generating the Modelo de negocio (projection model) PDF. The input
 * is the projection parameters as shown on the page; the server runs the shared
 * projection engine and renders the PDF. Bounds mirror the page's parseForm
 * validation so a request that the page would not run is rejected.
 */
export const generateModeloReportSchema = z.object({
  inversionInicial: z.number().nonnegative(),
  gastosFijosMensuales: z.number().nonnegative(),
  inversionMensual: z.number().nonnegative(),
  prestamoPromedio: z.number().positive(),
  tasaInteres: z.number().min(0).max(1),
  frecuenciaPago: z.enum(["DIARIO", "SEMANAL", "QUINCENAL", "MENSUAL"]),
  plazoBase: z.number().int().min(1),
  prestamosPorSemana: z.number().int().min(1),
  tasaMorosidad: z.number().min(0).max(1),
  tasaDefault: z.number().min(0).max(1),
  horizonteMeses: z.number().int().min(1).max(60)
});

export type GenerateModeloReportInput = z.infer<typeof generateModeloReportSchema>;
