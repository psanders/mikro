/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  generatePerformanceReportSchema,
  buildReportNarrativePrompt,
  parseReportNarrativeResponse,
  renderPerformanceReportToPng,
  type GeneratePerformanceReportInput,
  type DbClient,
  type PortfolioMetrics
} from "@mikro/common";
import { invokeTextPrompt } from "@mikro/agents";
import { createGeneratePortfolioMetrics } from "./createGeneratePortfolioMetrics.js";
import { logger } from "../../logger.js";

/**
 * Creates a function that generates the full performance report (metrics + LLM narrative + PNG).
 *
 * @param client - The database client
 * @returns A validated function that returns { image: base64 PNG, metrics }
 */
export function createGeneratePerformanceReport(client: DbClient) {
  const getMetrics = createGeneratePortfolioMetrics(client);

  const fn = async (
    params: GeneratePerformanceReportInput
  ): Promise<{ image: string; metrics: PortfolioMetrics }> => {
    const endDate = params.endDate ?? new Date();
    const startDate = params.startDate ?? new Date(endDate.getFullYear(), 0, 1, 0, 0, 0, 0); // year-to-date

    logger.verbose("generating performance report", {
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10)
    });

    const metrics = await getMetrics({ startDate, endDate });

    const prompt = buildReportNarrativePrompt(metrics);
    const rawContent = await invokeTextPrompt(prompt);
    const narrative = parseReportNarrativeResponse(rawContent);

    const generatedAt = new Date().toLocaleString("es-DO", {
      dateStyle: "medium",
      timeStyle: "short"
    });
    const pngBuffer = await renderPerformanceReportToPng(metrics, narrative, generatedAt);
    const image = pngBuffer.toString("base64");

    logger.verbose("performance report generated", {
      totalLoans: metrics.totalLoans,
      imageSizeKb: Math.round(pngBuffer.length / 1024)
    });

    return { image, metrics };
  };

  return withErrorHandlingAndValidation(fn, generatePerformanceReportSchema);
}
