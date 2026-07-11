/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Loan-statement report data builder. Resolves the loan through the shared
 * `fetchLoanSnapshotInput` Prisma adapter (the same query
 * `buildLoanSnapshotFromDb` uses — no second, divergent read) and hands the
 * DB-free snapshot input to the shared `loanStatementReport` definition
 * (`@mikro/common`) for JSON and/or PDF. This is the ONE code path the tRPC
 * procedure, the CLI command, and the founder-copilot's `generateLoanStatement`
 * direct tool all run through — CLI/tRPC/copilot parity by construction.
 */
import {
  loanStatementReport,
  withErrorHandlingAndValidation,
  generateLoanStatementSchema,
  type GenerateLoanStatementInput,
  type LoanStatementData,
  type RenderReportDeps,
  type DbClient
} from "@mikro/common";
import { logger } from "../../logger.js";
import { fetchLoanSnapshotInput } from "../loans/buildLoanSnapshotFromDb.js";

export interface GeneratedLoanStatement {
  /** The canonical, full typed data model — always present. */
  data: LoanStatementData;
  /** Base64 PDF bytes; present only when `format` is "pdf" (the default). */
  pdfBase64?: string;
  filename: string;
  mimeType: "application/pdf" | "application/json";
}

export interface GenerateLoanStatementOptions {
  /** Injected font loader for the PDF renderer — DI, no live gstatic fetch in tests. */
  renderDeps?: RenderReportDeps;
}

/**
 * Build the loan-statement copilot-tool/tRPC/CLI response for one loan. Read-only:
 * never mutates the loan or its payment ledger. Rejects an unknown loan id with
 * a clear "not found" error before any report code runs (no document produced).
 */
export function createGenerateLoanStatement(
  client: DbClient,
  options: GenerateLoanStatementOptions = {}
) {
  const fn = async (params: GenerateLoanStatementInput): Promise<GeneratedLoanStatement> => {
    const format = params.format ?? "pdf";
    logger.verbose("generating loan statement", { loanId: params.loanId, format });

    const input = await fetchLoanSnapshotInput(client, params.loanId);
    if (!input) {
      throw new Error(`Loan not found with loanId: ${params.loanId}`);
    }

    const data = await loanStatementReport.toJson(input);
    const date = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      return {
        data,
        filename: `estado-cuenta-${params.loanId}-${date}.json`,
        mimeType: "application/json"
      };
    }

    const pdf = await loanStatementReport.toPdf(input, options.renderDeps);
    logger.verbose("loan statement PDF ready", { loanId: params.loanId, bytes: pdf.length });

    return {
      data,
      pdfBase64: pdf.toString("base64"),
      filename: `estado-cuenta-${params.loanId}-${date}.pdf`,
      mimeType: "application/pdf"
    };
  };

  return withErrorHandlingAndValidation(fn, generateLoanStatementSchema);
}
