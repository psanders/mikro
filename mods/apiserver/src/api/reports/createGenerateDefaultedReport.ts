/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  generateDefaultedReportSchema,
  buildLoanNotesSummaryPrompt,
  parseLoanNotesSummaryResponse,
  getReportRowHighlight,
  defaultedReport,
  type GenerateDefaultedReportInput,
  type DbClient,
  type DefaultedReportRowInput,
  type DefaultedReportData,
  type RenderReportDeps
} from "@mikro/common";
import { invokeTextPrompt } from "@mikro/agents";
import { logger } from "../../logger.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { PaymentStatus } from "../../generated/prisma/enums.js";
import { loanToData } from "../../utils/loanToData.js";

const loanInclude = {
  customer: { select: { name: true, phone: true, preferredPaymentDay: true } },
  payments: {
    where: { status: { in: [PaymentStatus.COMPLETED, PaymentStatus.PARTIAL] } }
  },
  notes: {
    orderBy: { createdAt: "asc" as const },
    include: { createdBy: { select: { name: true } } }
  }
};

export interface GeneratedDefaultedReport {
  /** The canonical, full typed data model — always present. */
  data: DefaultedReportData;
  /** Base64 PDF bytes; present only when `format` is "pdf" (the default). */
  pdfBase64?: string;
  filename: string;
  mimeType: "application/pdf" | "application/json";
}

export interface GenerateDefaultedReportOptions {
  /** Injected font loader for the PDF renderer — DI, no live gstatic fetch in tests. */
  renderDeps?: RenderReportDeps;
}

/**
 * Resolve DEFAULTED + red-highlighted-ACTIVE loans and their at-risk rows.
 * Exported (in addition to the report builder below) for reuse by other
 * consumers of the same computation.
 */
export async function computeDefaultedReportInputs(
  client: DbClient,
  filter: "all" | "defaulted" | "late" = "all"
): Promise<{
  rows: DefaultedReportRowInput[];
  totalPrincipalAtRiskDop: number;
  defaultedCount: number;
  lateCount: number;
}> {
  const db = client as unknown as PrismaClient;

  type LoanWithInclude = Awaited<
    ReturnType<
      typeof db.loan.findMany<{
        where: { status: "DEFAULTED" };
        include: typeof loanInclude;
      }>
    >
  >[number];

  const defaultedLoans: LoanWithInclude[] =
    filter !== "late"
      ? await db.loan.findMany({
          where: { status: "DEFAULTED" },
          include: loanInclude
        })
      : [];

  let activeRedLoans: LoanWithInclude[] = [];
  if (filter !== "defaulted") {
    const activeLoans = await db.loan.findMany({
      where: { status: "ACTIVE" },
      include: loanInclude
    });
    activeRedLoans = activeLoans.filter((loan) => {
      const data = loanToData(loan, loan.customer.preferredPaymentDay);
      return getReportRowHighlight(data) === "red";
    });
  }

  const allLoans: LoanWithInclude[] = [...defaultedLoans, ...activeRedLoans];

  const summaryPromises = allLoans.map(async (loan) => {
    if (loan.notes.length === 0) {
      return "Sin notas";
    }
    const notesForPrompt = loan.notes.map((n) => ({
      content: n.content,
      createdAt: new Date(n.createdAt).toISOString(),
      createdBy: n.createdBy.name
    }));
    const prompt = buildLoanNotesSummaryPrompt(notesForPrompt);
    const raw = await invokeTextPrompt(prompt);
    return parseLoanNotesSummaryResponse(raw);
  });

  const summaries = await Promise.all(summaryPromises);

  const principalDecimalToNumber = (v: { toNumber?: () => number } | number): number =>
    typeof v === "number" ? v : ((v as { toNumber: () => number }).toNumber?.() ?? Number(v));

  const rows: DefaultedReportRowInput[] = allLoans.map((loan, i) => {
    const installmentRows = loan.payments.filter((p) => !p.kind || p.kind === "INSTALLMENT");
    const moraRows = loan.payments.filter((p) => p.kind === "LATE_FEE");
    const totalPaid = installmentRows.reduce(
      (sum, p) => sum + principalDecimalToNumber(p.amount),
      0
    );
    const moraCollected = moraRows.reduce((sum, p) => sum + principalDecimalToNumber(p.amount), 0);
    const isDefaulted = loan.status === "DEFAULTED";
    return {
      name: loan.customer.name,
      nickname: loan.nickname ?? null,
      phone: loan.customer.phone,
      loanId: loan.loanId,
      paymentFrequency: loan.paymentFrequency,
      totalPaid,
      moraCollected,
      summary: summaries[i] ?? "Sin notas",
      isDefaulted
    };
  });

  const totalPrincipalAtRiskDop = allLoans.reduce(
    (sum, loan) => sum + principalDecimalToNumber(loan.principal),
    0
  );

  return {
    rows,
    totalPrincipalAtRiskDop,
    defaultedCount: defaultedLoans.length,
    lateCount: activeRedLoans.length
  };
}

/**
 * Creates a function that generates the at-risk loans report (JSON/PDF via
 * the shared `defaultedReport` definition). Includes DEFAULTED loans and/or
 * ACTIVE loans with red highlight (3+ missed or deteriorating with 2+).
 * Optional filter: "all" (default), "defaulted", or "late".
 */
export function createGenerateDefaultedReport(
  client: DbClient,
  options: GenerateDefaultedReportOptions = {}
) {
  const fn = async (params: GenerateDefaultedReportInput): Promise<GeneratedDefaultedReport> => {
    const filter = params.filter ?? "all";
    const format = params.format ?? "pdf";
    logger.verbose("generating at-risk report", { filter, format });

    const { rows, totalPrincipalAtRiskDop, defaultedCount, lateCount } =
      await computeDefaultedReportInputs(client, filter);

    const input = { rows, totalPrincipalAtRiskDop };
    const data = await defaultedReport.toJson(input);
    const date = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      return {
        data,
        filename: `prestamos-en-riesgo-${date}.json`,
        mimeType: "application/json"
      };
    }

    const pdf = await defaultedReport.toPdf(input, options.renderDeps);
    logger.verbose("at-risk report generated", {
      loanCount: rows.length,
      defaultedCount,
      lateCount,
      pdfSizeKb: Math.round(pdf.length / 1024)
    });

    return {
      data,
      pdfBase64: pdf.toString("base64"),
      filename: `prestamos-en-riesgo-${date}.pdf`,
      mimeType: "application/pdf"
    };
  };

  return withErrorHandlingAndValidation(fn, generateDefaultedReportSchema);
}
