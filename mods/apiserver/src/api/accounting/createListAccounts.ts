/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listAccountsSchema,
  type ListAccountsInput,
  type AccountingAccount
} from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { toAccount } from "./mappers.js";

export function createListAccounts(client: PrismaClient) {
  const fn = async (params: ListAccountsInput): Promise<AccountingAccount[]> => {
    const accounts = await client.accountingAccount.findMany({
      where: params.includeInactive ? undefined : { isActive: true },
      orderBy: { name: "asc" }
    });
    return accounts.map(toAccount);
  };
  return withErrorHandlingAndValidation(fn, listAccountsSchema);
}
