/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listTransactionsSchema,
  type ListTransactionsInput,
  type AccountingTransactionWithRelations
} from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { toTransactionWithRelations } from "./mappers.js";

export function createListTransactions(client: PrismaClient) {
  const fn = async (
    params: ListTransactionsInput
  ): Promise<AccountingTransactionWithRelations[]> => {
    const transactions = await client.accountingTransaction.findMany({
      where: {
        occurredAt: { gte: params.startDate, lte: params.endDate },
        ...(params.accountId
          ? {
              OR: [{ accountId: params.accountId }, { toAccountId: params.accountId }]
            }
          : {}),
        ...(params.categoryId ? { categoryId: params.categoryId } : {}),
        ...(params.type ? { type: params.type } : {}),
        ...(params.includeReversed ? {} : { status: "POSTED" })
      },
      include: {
        account: { select: { id: true, name: true } },
        toAccount: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { attachments: true } }
      },
      orderBy: { occurredAt: "desc" },
      take: params.limit,
      skip: params.offset
    });
    return transactions.map(toTransactionWithRelations);
  };
  return withErrorHandlingAndValidation(fn, listTransactionsSchema);
}
