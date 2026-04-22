/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  getTransactionSchema,
  type GetTransactionInput,
  type AccountingTransactionWithRelations,
  type AccountingTransactionAttachment
} from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { toTransactionWithRelations, toAttachment } from "./mappers.js";

export interface GetTransactionResult extends AccountingTransactionWithRelations {
  attachments: AccountingTransactionAttachment[];
}

export function createGetTransaction(client: PrismaClient) {
  const fn = async (params: GetTransactionInput): Promise<GetTransactionResult | null> => {
    const row = await client.accountingTransaction.findUnique({
      where: { id: params.id },
      include: {
        account: { select: { id: true, name: true } },
        toAccount: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        attachments: true,
        _count: { select: { attachments: true } }
      }
    });
    if (!row) return null;
    return {
      ...toTransactionWithRelations(row),
      attachments: row.attachments.map(toAttachment)
    };
  };
  return withErrorHandlingAndValidation(fn, getTransactionSchema);
}
