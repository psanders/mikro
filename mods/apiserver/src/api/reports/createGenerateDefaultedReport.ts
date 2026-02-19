/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  withErrorHandlingAndValidation,
  generateDefaultedReportSchema,
  buildLoanNotesSummaryPrompt,
  parseLoanNotesSummaryResponse,
  renderDefaultedReportToPng,
  loadLogoDataUrl,
  type GenerateDefaultedReportInput,
  type DbClient,
  type DefaultedReportRow
} from "@mikro/common";
import { invokeTextPrompt } from "@mikro/agents";
import { logger } from "../../logger.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = join(__dirname, "../../../assets/logo.png");

/**
 * Creates a function that generates the defaulted loans report (PNG).
 * Queries DEFAULTED loans, sums payments, generates AI summary per loan from notes, then renders.
 *
 * @param client - The database client (Prisma)
 * @returns A validated function that returns { image: base64 PNG }
 */
export function createGenerateDefaultedReport(client: DbClient) {
  const db = client as unknown as PrismaClient;

  const fn = async (params: GenerateDefaultedReportInput): Promise<{ image: string }> => {
    logger.verbose("generating defaulted report", params);

    const loans = await db.loan.findMany({
      where: { status: "DEFAULTED" },
      include: {
        customer: { select: { name: true, phone: true } },
        payments: { where: { status: "COMPLETED" } },
        notes: {
          orderBy: { createdAt: "asc" },
          include: { createdBy: { select: { name: true } } }
        }
      }
    });

    const summaryPromises = loans.map(async (loan) => {
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

    const rows: DefaultedReportRow[] = loans.map((loan, i) => {
      const totalPaid = loan.payments.reduce(
        (sum, p) => sum + principalDecimalToNumber(p.amount),
        0
      );
      return {
        name: loan.customer.name,
        phone: loan.customer.phone,
        loanId: loan.loanId,
        paymentFrequency: loan.paymentFrequency,
        totalPaid,
        summary: summaries[i] ?? "Sin notas"
      };
    });

    const totalPrincipal = loans.reduce(
      (sum, loan) => sum + principalDecimalToNumber(loan.principal),
      0
    );

    const generatedAt = new Date().toLocaleString("es-DO", {
      dateStyle: "medium",
      timeStyle: "short"
    });
    const logoDataUrl = loadLogoDataUrl(LOGO_PATH);
    const pngBuffer = await renderDefaultedReportToPng(
      rows,
      totalPrincipal,
      generatedAt,
      logoDataUrl ?? undefined
    );
    const image = pngBuffer.toString("base64");

    logger.verbose("defaulted report generated", {
      loanCount: rows.length,
      imageSizeKb: Math.round(pngBuffer.length / 1024)
    });

    return { image };
  };

  return withErrorHandlingAndValidation(fn, generateDefaultedReportSchema);
}
