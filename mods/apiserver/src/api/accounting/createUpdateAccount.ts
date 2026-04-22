/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  updateAccountSchema,
  type UpdateAccountInput,
  type AccountingAccount
} from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { logger } from "../../logger.js";
import { toAccount } from "./mappers.js";

export function createUpdateAccount(client: PrismaClient) {
  const fn = async (params: UpdateAccountInput): Promise<AccountingAccount> => {
    logger.verbose("updating accounting account", { id: params.id });
    const data: Record<string, unknown> = {};
    if (params.name !== undefined) data.name = params.name;
    if (params.kind !== undefined) data.kind = params.kind;
    if (params.currency !== undefined) data.currency = params.currency;
    if (params.isActive !== undefined) data.isActive = params.isActive;
    if (params.notes !== undefined) data.notes = params.notes;

    const updated = await client.accountingAccount.update({
      where: { id: params.id },
      data
    });
    return toAccount(updated);
  };
  return withErrorHandlingAndValidation(fn, updateAccountSchema);
}
