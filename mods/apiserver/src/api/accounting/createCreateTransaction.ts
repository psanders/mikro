/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  createTransactionSchema,
  type CreateTransactionInput,
  type AccountingTransactionWithRelations
} from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { logger } from "../../logger.js";
import { saveTransactionAttachment } from "../../accounting/storage.js";
import { deltasForPost } from "./balance.js";
import { toTransactionWithRelations } from "./mappers.js";

export function createCreateTransaction(client: PrismaClient) {
  const fn = async (
    params: CreateTransactionInput
  ): Promise<AccountingTransactionWithRelations> => {
    logger.verbose("creating accounting transaction", {
      type: params.type,
      accountId: params.accountId,
      amount: params.amount
    });

    const fromAccount = await client.accountingAccount.findUnique({
      where: { id: params.accountId }
    });
    if (!fromAccount) throw new Error(`Account not found: ${params.accountId}`);
    if (!fromAccount.isActive) throw new Error(`Account is inactive: ${fromAccount.name}`);

    let toAccount = null as Awaited<ReturnType<typeof client.accountingAccount.findUnique>> | null;
    if (params.type === "TRANSFER") {
      toAccount = await client.accountingAccount.findUnique({
        where: { id: params.toAccountId! }
      });
      if (!toAccount) throw new Error(`Destination account not found: ${params.toAccountId}`);
      if (!toAccount.isActive)
        throw new Error(`Destination account is inactive: ${toAccount.name}`);
      if (toAccount.currency !== fromAccount.currency) {
        throw new Error(
          `Cannot transfer between accounts with different currencies (${fromAccount.currency} → ${toAccount.currency})`
        );
      }
    }

    if (params.categoryId) {
      const category = await client.accountingCategory.findUnique({
        where: { id: params.categoryId }
      });
      if (!category) throw new Error(`Category not found: ${params.categoryId}`);
      if (
        (params.type === "EXPENSE" && category.kind !== "EXPENSE") ||
        (params.type === "INCOME" && category.kind !== "INCOME")
      ) {
        throw new Error(
          `Category kind ${category.kind} does not match transaction type ${params.type}`
        );
      }
    }

    const creator = await client.user.findUnique({ where: { id: params.createdById } });
    if (!creator) throw new Error(`User not found: ${params.createdById}`);

    const deltas = deltasForPost(params.type, params.amount);

    const savedAttachments = (params.attachments ?? []).map((a, idx) => ({
      input: a,
      stagingId: `staging-${idx}`
    }));

    const created = await client.$transaction(async (tx) => {
      const txn = await tx.accountingTransaction.create({
        data: {
          type: params.type,
          amount: params.amount,
          occurredAt: params.occurredAt,
          description: params.description ?? null,
          vendor: params.vendor ?? null,
          reference: params.reference ?? null,
          accountId: params.accountId,
          toAccountId: params.type === "TRANSFER" ? params.toAccountId! : null,
          categoryId: params.categoryId ?? null,
          createdById: params.createdById
        }
      });

      await tx.accountingAccount.update({
        where: { id: params.accountId },
        data: { currentBalance: { increment: deltas.account } }
      });
      if (deltas.toAccount !== undefined && params.toAccountId) {
        await tx.accountingAccount.update({
          where: { id: params.toAccountId },
          data: { currentBalance: { increment: deltas.toAccount } }
        });
      }

      if (savedAttachments.length > 0) {
        for (const a of savedAttachments) {
          const saved = saveTransactionAttachment({
            transactionId: txn.id,
            mimeType: a.input.mimeType,
            dataBase64: a.input.dataBase64
          });
          await tx.accountingTransactionAttachment.create({
            data: {
              transactionId: txn.id,
              filename: saved.filename,
              originalName: a.input.originalName ?? null,
              mimeType: a.input.mimeType,
              size: saved.size,
              sha256: saved.sha256
            }
          });
        }
      }

      const full = await tx.accountingTransaction.findUniqueOrThrow({
        where: { id: txn.id },
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

    logger.verbose("accounting transaction created", { id: created.id });
    return toTransactionWithRelations(created);
  };

  return withErrorHandlingAndValidation(fn, createTransactionSchema);
}
