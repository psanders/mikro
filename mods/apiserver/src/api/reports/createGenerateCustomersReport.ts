/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Customers report data builder. Reads all active customers + their active
 * loans/completed payments — the exact same query `createExportAllCustomers`
 * already used to feed the Excel/PNG export path — and hands them to the
 * shared `customersReport` definition (`@mikro/common`) for JSON and/or PDF.
 * No collector-scoped variant: this migration mirrors the pre-migration
 * `exportAllCustomers` (all active customers) scope only.
 */
import {
  withErrorHandlingAndValidation,
  customersReport,
  generateCustomersReportSchema,
  type GenerateCustomersReportInput,
  type DbClient,
  type CustomersReportData,
  type RenderReportDeps
} from "@mikro/common";
import { logger } from "../../logger.js";

export interface GeneratedCustomersReport {
  /** The canonical, full typed data model — always present. */
  data: CustomersReportData;
  /** Base64 PDF bytes; present only when `format` is "pdf" (the default). */
  pdfBase64?: string;
  filename: string;
  mimeType: "application/pdf" | "application/json";
}

export interface GenerateCustomersReportOptions {
  /** Injected font loader for the PDF renderer — DI, no live gstatic fetch in tests. */
  renderDeps?: RenderReportDeps;
}

/**
 * Creates a function that generates the customers report (JSON/PDF via the
 * shared `customersReport` definition): every active customer's active loans,
 * grouped by payment health (Crítico / Requiere atención / Al día).
 */
export function createGenerateCustomersReport(
  client: DbClient,
  options: GenerateCustomersReportOptions = {}
) {
  const fn = async (params: GenerateCustomersReportInput): Promise<GeneratedCustomersReport> => {
    const format = params.format ?? "pdf";
    logger.verbose("generating customers report", { format });

    const customers = await client.customer.findMany({
      where: { isActive: true },
      include: {
        loans: {
          where: { status: "ACTIVE" },
          include: {
            payments: {
              where: { status: "COMPLETED" },
              orderBy: { paidAt: "desc" }
            }
          }
        }
      }
    });

    const input = { customers };
    const data = await customersReport.toJson(input);
    const date = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      return {
        data,
        filename: `clientes-${date}.json`,
        mimeType: "application/json"
      };
    }

    const pdf = await customersReport.toPdf(input, options.renderDeps);
    logger.verbose("customers report generated", {
      customerCount: customers.length,
      pdfSizeKb: Math.round(pdf.length / 1024)
    });

    return {
      data,
      pdfBase64: pdf.toString("base64"),
      filename: `clientes-${date}.pdf`,
      mimeType: "application/pdf"
    };
  };

  return withErrorHandlingAndValidation(fn, generateCustomersReportSchema);
}
