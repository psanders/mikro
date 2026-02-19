/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  generateDefaultedReportSchema,
  buildLoanNotesSummaryPrompt,
  parseLoanNotesSummaryResponse,
  renderDefaultedReportToPng,
  loadLogoDataUrl,
  getLogoPath,
  getReportRowHighlight,
  type GenerateDefaultedReportInput,
  type DbClient,
  type DefaultedReportRow
} from "@mikro/common";
import { invokeTextPrompt } from "@mikro/agents";
import { logger } from "../../logger.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { loanToData } from "../../collections/loanToData.js";

const loanInclude = {
  customer: { select: { name: true, phone: true, preferredPaymentDay: true } },
  payments: { where: { status: "COMPLETED" as const } },
  notes: {
    orderBy: { createdAt: "asc" as const },
    include: { createdBy: { select: { name: true } } }
  }
};

/**
 * Creates a function that generates the at-risk loans report (PNG).
 * Includes DEFAULTED loans and/or ACTIVE loans with red highlight (3+ missed or deteriorating with 2+).
 * Optional filter: "all" (default), "defaulted", or "late".
 *
 * @param client - The database client (Prisma)
 * @returns A validated function that returns { image: base64 PNG }
 */
export function createGenerateDefaultedReport(client: DbClient) {
  const db = client as unknown as PrismaClient;

  const fn = async (params: GenerateDefaultedReportInput): Promise<{ image: string }> => {
    const filter = params.filter ?? "all";
    logger.verbose("generating at-risk report", { filter });

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

    const rows: DefaultedReportRow[] = allLoans.map((loan, i) => {
      const totalPaid = loan.payments.reduce(
        (sum, p) => sum + principalDecimalToNumber(p.amount),
        0
      );
      const isDefaulted = loan.status === "DEFAULTED";
      return {
        name: loan.customer.name,
        phone: loan.customer.phone,
        loanId: loan.loanId,
        nickname: loan.nickname ?? "",
        paymentFrequency: loan.paymentFrequency,
        totalPaid,
        summary: summaries[i] ?? "Sin notas",
        isDefaulted
      };
    });

    const totalPrincipal = allLoans.reduce(
      (sum, loan) => sum + principalDecimalToNumber(loan.principal),
      0
    );

    const generatedAt = new Date().toLocaleString("es-DO", {
      dateStyle: "medium",
      timeStyle: "short"
    });
    const logoDataUrl = loadLogoDataUrl(getLogoPath());
    const pngBuffer = await renderDefaultedReportToPng(
      rows,
      totalPrincipal,
      generatedAt,
      logoDataUrl ?? undefined
    );
    const image = pngBuffer.toString("base64");

    logger.verbose("at-risk report generated", {
      loanCount: rows.length,
      defaultedCount: defaultedLoans.length,
      lateCount: activeRedLoans.length,
      imageSizeKb: Math.round(pngBuffer.length / 1024)
    });

    return { image };
  };

  return withErrorHandlingAndValidation(fn, generateDefaultedReportSchema);
}
