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
  renderRenewalReportToPng,
  loadLogoDataUrl,
  getLogoPath,
  getMissedPaymentsCount,
  type GenerateRenewalCandidatesReportInput,
  type DbClient,
  type RenewalReportRow,
  type LoanPaymentDataWithTerm
} from "@mikro/common";
import { invokeTextPrompt } from "@mikro/agents";
import { logger } from "../../logger.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { loanToData } from "../../collections/loanToData.js";

const loanInclude = {
  customer: { select: { name: true, phone: true, preferredPaymentDay: true } },
  payments: { where: { status: "COMPLETED" as const }, orderBy: { paidAt: "asc" as const } }
};

/**
 * Creates a function that generates the renewal candidates report (PNG).
 * Includes ACTIVE loans near completion (by config thresholds) and COMPLETED loans.
 * Each row has payment rating and an AI-generated candidacy note.
 */
export function createGenerateRenewalCandidatesReport(client: DbClient) {
  const db = client as unknown as PrismaClient;

  const fn = async (params: GenerateRenewalCandidatesReportInput): Promise<{ image: string }> => {
    void params;
    logger.verbose("generating renewal candidates report");

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

    const rows: RenewalReportRow[] = eligibleLoans.map((loan, i) => {
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

    const generatedAt = new Date().toLocaleString("es-DO", {
      dateStyle: "medium",
      timeStyle: "short"
    });
    const logoDataUrl = loadLogoDataUrl(getLogoPath());
    const pngBuffer = await renderRenewalReportToPng(rows, generatedAt, logoDataUrl ?? undefined);
    const image = pngBuffer.toString("base64");

    logger.verbose("renewal candidates report generated", {
      loanCount: rows.length,
      imageSizeKb: Math.round(pngBuffer.length / 1024)
    });

    return { image };
  };

  return withErrorHandlingAndValidation(fn, generateRenewalCandidatesReportSchema);
}
