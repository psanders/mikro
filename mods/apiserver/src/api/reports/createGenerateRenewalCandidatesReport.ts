/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  generateRenewalCandidatesReportSchema,
  getConfig,
  getRenewalCandidateMetrics,
  buildRenewalCandidateNotePrompt,
  parseRenewalCandidateNoteResponse,
  getMissedPaymentsCount,
  renewalReport,
  type GenerateRenewalCandidatesReportInput,
  type DbClient,
  type RenewalReportRowInput,
  type RenewalReportData,
  type LoanPaymentDataWithTerm,
  type RenderReportDeps
} from "@mikro/common";
import { invokeTextPrompt } from "@mikro/agents";
import { logger } from "../../logger.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { loanToData } from "../../utils/loanToData.js";

const loanInclude = {
  customer: { select: { name: true, phone: true, preferredPaymentDay: true } },
  payments: {
    where: { status: "COMPLETED" as const, kind: "INSTALLMENT" as const },
    orderBy: { paidAt: "asc" as const }
  }
};

export interface GeneratedRenewalCandidatesReport {
  /** The canonical, full typed data model — always present. */
  data: RenewalReportData;
  /** Base64 PDF bytes; present only when `format` is "pdf" (the default). */
  pdfBase64?: string;
  filename: string;
  mimeType: "application/pdf" | "application/json";
}

export interface GenerateRenewalCandidatesReportOptions {
  /** Injected font loader for the PDF renderer — DI, no live gstatic fetch in tests. */
  renderDeps?: RenderReportDeps;
}

/**
 * Resolve renewal-candidate rows: ACTIVE loans near completion (by config
 * thresholds) plus COMPLETED loans, each with a payment rating and an
 * AI-generated candidacy note. Exported (in addition to the report builder
 * below) for reuse by other consumers of the same computation.
 */
export async function computeRenewalReportRows(
  client: DbClient
): Promise<{ rows: RenewalReportRowInput[] }> {
  const db = client as unknown as PrismaClient;
  const config = getConfig();
  const thresholds = config.reports?.nearCompletionThresholds ?? undefined;

  type LoanWithInclude = Awaited<
    ReturnType<
      typeof db.loan.findMany<{
        where: { status: { in: ["ACTIVE", "COMPLETED"] } };
        include: typeof loanInclude;
      }>
    >
  >[number];

  const loans: LoanWithInclude[] = await db.loan.findMany({
    where: { status: { in: ["ACTIVE", "COMPLETED"] } },
    include: loanInclude
  });

  const asOfDate = new Date();

  const eligibleLoans: LoanWithInclude[] = [];
  for (const loan of loans) {
    const data = loanToData(loan, loan.customer.preferredPaymentDay);
    const withTerm: LoanPaymentDataWithTerm = {
      ...data,
      termLength: loan.termLength
    };
    const metrics = getRenewalCandidateMetrics(withTerm, thresholds, asOfDate);
    if (loan.status === "COMPLETED" || metrics.isNearCompletion) {
      eligibleLoans.push(loan);
    }
  }

  const notePromises = eligibleLoans.map(async (loan) => {
    const isCompleted = loan.status === "COMPLETED";
    const paymentsMade = loan.payments.length;
    const remaining = isCompleted ? 0 : Math.max(0, loan.termLength - paymentsMade);

    const data = loanToData(loan, loan.customer.preferredPaymentDay);
    const withTerm: LoanPaymentDataWithTerm = { ...data, termLength: loan.termLength };
    const metrics = getRenewalCandidateMetrics(withTerm, thresholds, asOfDate);
    const missedPayments = getMissedPaymentsCount(withTerm, asOfDate);

    const prompt = buildRenewalCandidateNotePrompt({
      paymentRating: metrics.paymentRating,
      remainingInstallments: remaining,
      termLength: loan.termLength,
      paymentsMade,
      missedPayments
    });
    const raw = await invokeTextPrompt(prompt);
    return parseRenewalCandidateNoteResponse(raw);
  });

  const candidateNotes = await Promise.all(notePromises);

  const rows: RenewalReportRowInput[] = eligibleLoans.map((loan, i) => {
    const isCompleted = loan.status === "COMPLETED";
    const paymentsMade = loan.payments.length;
    const data = loanToData(loan, loan.customer.preferredPaymentDay);
    const withTerm: LoanPaymentDataWithTerm = { ...data, termLength: loan.termLength };
    const metrics = getRenewalCandidateMetrics(withTerm, thresholds, asOfDate);
    return {
      name: loan.customer.name,
      phone: loan.customer.phone,
      loanId: loan.loanId,
      paymentFrequency: loan.paymentFrequency,
      paymentsMade,
      termLength: loan.termLength,
      paymentRating: metrics.paymentRating,
      candidateNote: candidateNotes[i] ?? "—",
      isCompleted
    };
  });

  return { rows };
}

/**
 * Creates a function that generates the renewal candidates report (JSON/PDF
 * via the shared `renewalReport` definition). Includes ACTIVE loans near
 * completion (by config thresholds) and COMPLETED loans. Each row has a
 * payment rating and an AI-generated candidacy note.
 *
 * `suggestedAmountDop` is not yet computed here (no renewal-amount engine
 * exists upstream) — omitted per row, which the shared definition renders as
 * "—" for the "Monto sugerido" KPI. Flag to the data owner if/when a real
 * suggestion should be piped in.
 */
export function createGenerateRenewalCandidatesReport(
  client: DbClient,
  options: GenerateRenewalCandidatesReportOptions = {}
) {
  const fn = async (
    params: GenerateRenewalCandidatesReportInput
  ): Promise<GeneratedRenewalCandidatesReport> => {
    const format = params.format ?? "pdf";
    logger.verbose("generating renewal candidates report", { format });

    const { rows } = await computeRenewalReportRows(client);

    const input = { rows };
    const data = await renewalReport.toJson(input);
    const date = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      return {
        data,
        filename: `renovacion-${date}.json`,
        mimeType: "application/json"
      };
    }

    const pdf = await renewalReport.toPdf(input, options.renderDeps);
    logger.verbose("renewal candidates report generated", {
      loanCount: rows.length,
      pdfSizeKb: Math.round(pdf.length / 1024)
    });

    return {
      data,
      pdfBase64: pdf.toString("base64"),
      filename: `renovacion-${date}.pdf`,
      mimeType: "application/pdf"
    };
  };

  return withErrorHandlingAndValidation(fn, generateRenewalCandidatesReportSchema);
}
