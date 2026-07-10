/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Performance report data builder. Computes portfolio metrics + the LLM
 * narrative exactly as before, then hands both to the shared
 * `performanceReport` definition (`@mikro/common`) for JSON and/or PDF —
 * the satori→PNG path is no longer called from here.
 */
import {
  withErrorHandlingAndValidation,
  generatePerformanceReportSchema,
  buildReportNarrativePrompt,
  parseReportNarrativeResponse,
  performanceReport,
  type GeneratePerformanceReportInput,
  type DbClient,
  type PerformanceReportData,
  type PortfolioMetrics,
  type ReportNarrative,
  type RenderReportDeps
} from "@mikro/common";
import { invokeTextPrompt } from "@mikro/agents";
import { createGeneratePortfolioMetrics } from "./createGeneratePortfolioMetrics.js";
import { logger } from "../../logger.js";

/**
 * Compute the metrics + LLM narrative pair the performance report is built
 * from. Exported (in addition to the report builder below) for reuse by
 * other consumers of the same computation.
 */
export async function computePerformanceReportInputs(
  client: DbClient,
  params: { startDate?: Date; endDate?: Date }
): Promise<{ metrics: PortfolioMetrics; narrative: ReportNarrative }> {
  const getMetrics = createGeneratePortfolioMetrics(client);
  const endDate = params.endDate ?? new Date();
  const startDate = params.startDate ?? new Date(endDate.getFullYear(), 0, 1, 0, 0, 0, 0); // year-to-date

  const metrics = await getMetrics({ startDate, endDate });
  const prompt = buildReportNarrativePrompt(metrics);
  const rawContent = await invokeTextPrompt(prompt);
  const narrative = parseReportNarrativeResponse(rawContent);

  return { metrics, narrative };
}

export interface GeneratedPerformanceReport {
  /** The canonical, full typed data model — always present. */
  data: PerformanceReportData;
  /** Base64 PDF bytes; present only when `format` is "pdf" (the default). */
  pdfBase64?: string;
  filename: string;
  mimeType: "application/pdf" | "application/json";
}

export interface GeneratePerformanceReportOptions {
  /** Injected font loader for the PDF renderer — DI, no live gstatic fetch in tests. */
  renderDeps?: RenderReportDeps;
}

/**
 * Creates a function that generates the full performance report (metrics +
 * LLM narrative + JSON/PDF via the shared `performanceReport` definition).
 */
export function createGeneratePerformanceReport(
  client: DbClient,
  options: GeneratePerformanceReportOptions = {}
) {
  const fn = async (
    params: GeneratePerformanceReportInput
  ): Promise<GeneratedPerformanceReport> => {
    const format = params.format ?? "pdf";

    logger.verbose("generating performance report", {
      startDate: params.startDate?.toISOString().slice(0, 10),
      endDate: params.endDate?.toISOString().slice(0, 10),
      format
    });

    const { metrics, narrative } = await computePerformanceReportInputs(client, params);

    const input = { metrics, narrative };
    const data = await performanceReport.toJson(input);
    const date = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      return {
        data,
        filename: `desempeno-${date}.json`,
        mimeType: "application/json"
      };
    }

    const pdf = await performanceReport.toPdf(input, options.renderDeps);
    logger.verbose("performance report generated", {
      totalLoans: metrics.totalLoans,
      pdfSizeKb: Math.round(pdf.length / 1024)
    });

    return {
      data,
      pdfBase64: pdf.toString("base64"),
      filename: `desempeno-${date}.pdf`,
      mimeType: "application/pdf"
    };
  };

  return withErrorHandlingAndValidation(fn, generatePerformanceReportSchema);
}
