/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Generates the accounting snapshot report: account balances + transaction
 * ledger, projected into JSON and/or PDF via the shared `accountingReport`
 * definition (`@mikro/common`).
 */
import {
  withErrorHandlingAndValidation,
  accountingReport,
  generateAccountingReportSchema,
  type GenerateAccountingReportInput,
  type AccountingReportSnapshot,
  type AccountingReportAccountRow,
  type AccountingReportTransactionRow,
  type RenderReportDeps
} from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { toAccount, toTransactionWithRelations } from "../accounting/mappers.js";
import { logger } from "../../logger.js";

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface GeneratedAccountingReport {
  /** The canonical, full typed data model — always present. */
  data: AccountingReportSnapshot;
  /** Base64 PDF bytes; present only when `format` is "pdf" (the default). */
  pdfBase64?: string;
  filename: string;
  mimeType: "application/pdf" | "application/json";
}

export interface GenerateAccountingReportOptions {
  /** Injected font loader for the PDF renderer — DI, no live gstatic fetch in tests. */
  renderDeps?: RenderReportDeps;
}

/**
 * Creates a function that generates the accounting snapshot report (JSON/PDF
 * via the shared `accountingReport` definition). Default period: month-to-date.
 */
export function createGenerateAccountingReport(
  client: PrismaClient,
  options: GenerateAccountingReportOptions = {}
) {
  const fn = async (params: GenerateAccountingReportInput): Promise<GeneratedAccountingReport> => {
    const format = params.format ?? "pdf";
    const endDate = params.endDate ?? new Date();
    const startDate =
      params.startDate ?? new Date(endDate.getFullYear(), endDate.getMonth(), 1, 0, 0, 0, 0);

    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [accounts, transactions] = await Promise.all([
      client.accountingAccount.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" }
      }),
      client.accountingTransaction.findMany({
        where: {
          occurredAt: { gte: startDate, lte: endOfDay },
          status: "POSTED"
        },
        include: {
          account: { select: { id: true, name: true } },
          toAccount: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { attachments: true } }
        },
        orderBy: { occurredAt: "desc" }
      })
    ]);

    const mappedAccounts: AccountingReportAccountRow[] = accounts.map((a) => {
      const mapped = toAccount(a);
      return {
        name: mapped.name,
        kind: mapped.kind,
        currency: mapped.currency,
        currentBalance: mapped.currentBalance
      };
    });

    const mappedTransactions: AccountingReportTransactionRow[] = transactions.map((t) => {
      const mapped = toTransactionWithRelations(t);
      return {
        occurredAt: mapped.occurredAt.toISOString(),
        type: mapped.type,
        accountName: mapped.account.name,
        categoryName: mapped.category?.name ?? null,
        vendor: mapped.vendor,
        description: mapped.description,
        amount: mapped.amount
      };
    });

    let totalIncome = 0;
    let totalExpenses = 0;
    for (const t of mappedTransactions) {
      if (t.type === "INCOME" || t.type === "DEPOSIT") {
        totalIncome += t.amount;
      } else if (t.type === "EXPENSE" || t.type === "WITHDRAWAL") {
        totalExpenses += t.amount;
      }
    }

    const combinedBalance = mappedAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

    const input = {
      period: { startDate: toISODate(startDate), endDate: toISODate(endDate) },
      accounts: mappedAccounts,
      transactions: mappedTransactions,
      totals: {
        totalIncome,
        totalExpenses,
        netFlow: totalIncome - totalExpenses,
        combinedBalance
      }
    };

    const data = await accountingReport.toJson(input);
    const filenamePeriod = `${input.period.startDate}-to-${input.period.endDate}`;

    if (format === "json") {
      return {
        data,
        filename: `contable-${filenamePeriod}.json`,
        mimeType: "application/json"
      };
    }

    const pdf = await accountingReport.toPdf(input, options.renderDeps);
    logger.verbose("accounting report generated", {
      period: data.period,
      accountCount: mappedAccounts.length,
      txnCount: mappedTransactions.length,
      pdfSizeKb: Math.round(pdf.length / 1024)
    });

    return {
      data,
      pdfBase64: pdf.toString("base64"),
      filename: `contable-${filenamePeriod}.pdf`,
      mimeType: "application/pdf"
    };
  };

  return withErrorHandlingAndValidation(fn, generateAccountingReportSchema);
}
