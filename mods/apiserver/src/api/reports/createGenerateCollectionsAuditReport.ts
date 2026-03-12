/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Generates the daily collections audit report: rows + PNG image.
 */
import {
  withErrorHandlingAndValidation,
  renderCollectionsAuditReportToPng,
  loadLogoDataUrl,
  getLogoPath,
  generateCollectionsAuditReportSchema,
  type GenerateCollectionsAuditReportInput,
  type DbClient
} from "@mikro/common";
import { logger } from "../../logger.js";
import { createGetCollectionsAuditReport } from "./createGetCollectionsAuditReport.js";

/**
 * Creates a function that generates the collections audit report (rows + PNG).
 * Default date is today. Returns { rows, image } for tabular use and sharing.
 *
 * @param client - The database client (Prisma)
 * @returns A validated function that returns { rows, image }
 */
export function createGenerateCollectionsAuditReport(client: DbClient) {
  const getReport = createGetCollectionsAuditReport(client);

  const fn = async (
    params: GenerateCollectionsAuditReportInput
  ): Promise<{ rows: Awaited<ReturnType<typeof getReport>>["rows"]; image: string }> => {
    const { rows } = await getReport(params);
    const auditDate = params.date ?? new Date();
    const auditDateLabel = auditDate.toLocaleDateString("es-DO", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric"
    });
    const generatedAt = new Date().toLocaleString("es-DO", {
      dateStyle: "medium",
      timeStyle: "short"
    });
    const logoDataUrl = loadLogoDataUrl(getLogoPath());
    const pngBuffer = await renderCollectionsAuditReportToPng(
      rows,
      auditDateLabel,
      generatedAt,
      logoDataUrl ?? undefined
    );
    const image = pngBuffer.toString("base64");

    logger.verbose("collections audit report generated", {
      rowCount: rows.length,
      imageSizeKb: Math.round(pngBuffer.length / 1024)
    });

    return { rows, image };
  };

  return withErrorHandlingAndValidation(fn, generateCollectionsAuditReportSchema);
}
