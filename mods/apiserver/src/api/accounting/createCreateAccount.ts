/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  createAccountSchema,
  type CreateAccountInput,
  type AccountingAccount
} from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { logger } from "../../logger.js";
import { toAccount } from "./mappers.js";

export function createCreateAccount(client: PrismaClient) {
  const fn = async (params: CreateAccountInput): Promise<AccountingAccount> => {
    logger.verbose("creating accounting account", { name: params.name, kind: params.kind });
    const opening = params.openingBalance ?? 0;
    const created = await client.accountingAccount.create({
      data: {
        name: params.name,
        kind: params.kind ?? "BANK",
        currency: params.currency ?? "DOP",
        openingBalance: opening,
        currentBalance: opening,
        notes: params.notes ?? null
      }
    });
    logger.verbose("accounting account created", { id: created.id });
    return toAccount(created);
  };
  return withErrorHandlingAndValidation(fn, createAccountSchema);
}
