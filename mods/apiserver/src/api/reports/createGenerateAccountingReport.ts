/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Generates the accounting snapshot report: account balances + transaction ledger + PNG.
 */
import {
  withErrorHandlingAndValidation,
  renderAccountingReportToPng,
  loadLogoDataUrl,
  getLogoPath,
  generateAccountingReportSchema,
  type GenerateAccountingReportInput,
  type AccountingReportData,
  type AccountingReportAccount,
  type AccountingReportTransaction
} from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { toAccount, toTransactionWithRelations } from "../accounting/mappers.js";
import { logger } from "../../logger.js";

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Creates a function that generates the accounting snapshot report (data + PNG).
 * Default period: month-to-date.
 */
export function createGenerateAccountingReport(client: PrismaClient) {
  const fn = async (
    params: GenerateAccountingReportInput
  ): Promise<{ data: AccountingReportData; image: string }> => {
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

    const mappedAccounts: AccountingReportAccount[] = accounts.map((a) => {
      const mapped = toAccount(a);
      return {
        name: mapped.name,
        kind: mapped.kind,
        currency: mapped.currency,
        currentBalance: mapped.currentBalance
      };
    });

    const mappedTransactions: AccountingReportTransaction[] = transactions.map((t) => {
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

    const data: AccountingReportData = {
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

    const generatedAt = new Date().toLocaleString("es-DO", {
      dateStyle: "medium",
      timeStyle: "short"
    });
    const logoDataUrl = loadLogoDataUrl(getLogoPath());
    const pngBuffer = await renderAccountingReportToPng(
      data,
      generatedAt,
      logoDataUrl ?? undefined
    );
    const image = pngBuffer.toString("base64");

    logger.verbose("accounting report generated", {
      period: data.period,
      accountCount: mappedAccounts.length,
      txnCount: mappedTransactions.length,
      imageSizeKb: Math.round(pngBuffer.length / 1024)
    });

    return { data, image };
  };

  return withErrorHandlingAndValidation(fn, generateAccountingReportSchema);
}
