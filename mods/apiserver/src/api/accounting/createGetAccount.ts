/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  getAccountSchema,
  type GetAccountInput,
  type AccountingAccount
} from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { toAccount } from "./mappers.js";

export function createGetAccount(client: PrismaClient) {
  const fn = async (params: GetAccountInput): Promise<AccountingAccount | null> => {
    const account = await client.accountingAccount.findUnique({ where: { id: params.id } });
    return account ? toAccount(account) : null;
  };
  return withErrorHandlingAndValidation(fn, getAccountSchema);
}
