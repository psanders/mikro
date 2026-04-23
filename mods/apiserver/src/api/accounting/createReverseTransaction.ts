/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  reverseTransactionInternalSchema,
  type ReverseTransactionInternalInput,
  type AccountingTransactionWithRelations
} from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { logger } from "../../logger.js";
import { deltasForReverse } from "./balance.js";
import { toTransactionWithRelations } from "./mappers.js";

export function createReverseTransaction(client: PrismaClient) {
  const fn = async (
    params: ReverseTransactionInternalInput
  ): Promise<AccountingTransactionWithRelations> => {
    logger.verbose("reversing accounting transaction", { id: params.id });

    const original = await client.accountingTransaction.findUnique({
      where: { id: params.id }
    });
    if (!original) throw new Error(`Transaction not found: ${params.id}`);
    if (original.status === "REVERSED") {
      throw new Error(`Transaction ${params.id} is already reversed`);
    }
    if (original.reversalOfId) {
      throw new Error(`Cannot reverse a transaction that is itself a reversal`);
    }

    const creator = await client.user.findUnique({ where: { id: params.createdById } });
    if (!creator) throw new Error(`User not found: ${params.createdById}`);

    const amount = Number(original.amount);
    const deltas = deltasForReverse(original.type, amount);

    const reversal = await client.$transaction(async (tx) => {
      await tx.accountingTransaction.update({
        where: { id: original.id },
        data: { status: "REVERSED" }
      });

      const reversalRow = await tx.accountingTransaction.create({
        data: {
          type: original.type,
          status: "POSTED",
          amount,
          occurredAt: new Date(),
          description:
            params.notes ??
            `Reversal of ${original.id}${original.description ? ` — ${original.description}` : ""}`,
          vendor: original.vendor,
          reference: original.reference,
          accountId: original.accountId,
          toAccountId: original.toAccountId,
          categoryId: original.categoryId,
          createdById: params.createdById,
          reversalOfId: original.id
        }
      });

      await tx.accountingAccount.update({
        where: { id: original.accountId },
        data: { currentBalance: { increment: deltas.account } }
      });
      if (deltas.toAccount !== undefined && original.toAccountId) {
        await tx.accountingAccount.update({
          where: { id: original.toAccountId },
          data: { currentBalance: { increment: deltas.toAccount } }
        });
      }

      const full = await tx.accountingTransaction.findUniqueOrThrow({
        where: { id: reversalRow.id },
        include: {
          account: { select: { id: true, name: true } },
          toAccount: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { attachments: true } }
        }
      });
      return full;
    });

    logger.verbose("accounting transaction reversed", {
      originalId: original.id,
      reversalId: reversal.id
    });
    return toTransactionWithRelations(reversal);
  };

  return withErrorHandlingAndValidation(fn, reverseTransactionInternalSchema);
}
