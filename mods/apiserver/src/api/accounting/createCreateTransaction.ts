/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  createTransactionInternalSchema,
  type CreateTransactionInternalInput,
  type AccountingTransactionWithRelations
} from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { postTransactionCore } from "./postTransaction.js";

export function createCreateTransaction(client: PrismaClient) {
  const fn = async (
    params: CreateTransactionInternalInput
  ): Promise<AccountingTransactionWithRelations> => {
    return client.$transaction((tx) => postTransactionCore(tx as unknown as PrismaClient, params));
  };

  return withErrorHandlingAndValidation(fn, createTransactionInternalSchema);
}
