/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Which ledger accounts a loan disbursement may come from. Configured in
 * mikro.json (`accounting.disbursementAccounts`, default
 * `accounting.disbursementAccountId`) so the panel only ever offers the right
 * ones — e.g. Caja General and Cuenta de Recaudación — instead of every account.
 */
import { amountToNumber, getDisbursementAccountOptions } from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { TRPCError } from "@trpc/server";

export interface DisbursementAccount {
  id: string;
  /** Configured name, falling back to the ledger account's own name. */
  name: string;
  isDefault: boolean;
  /** Live ledger balance; null when the account is missing from the ledger. */
  balance: number | null;
  /** False when the configured id is unknown or the account is inactive. */
  available: boolean;
}

/** The configured accounts with their live balance, default first. */
export async function listDisbursementAccounts(
  client: PrismaClient
): Promise<DisbursementAccount[]> {
  const options = getDisbursementAccountOptions();
  const rows = await client.accountingAccount.findMany({
    where: { id: { in: options.map((o) => o.id) } },
    select: { id: true, name: true, currentBalance: true, isActive: true }
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return options.map((o) => {
    const row = byId.get(o.id);
    return {
      id: o.id,
      name: o.name ?? row?.name ?? "Cuenta sin nombre",
      isDefault: o.isDefault,
      balance: row ? amountToNumber(row.currentBalance) : null,
      available: Boolean(row?.isActive)
    };
  });
}

/**
 * Resolve the account a conversion disburses from: the requested one if it is
 * configured for disbursements, else the default. Refuses anything else so a
 * disbursement can never come out of, say, a credit card or an expense account.
 */
export function resolveDisbursementAccountId(requested?: string): string {
  const options = getDisbursementAccountOptions();
  const fallback = options.find((o) => o.isDefault)!.id;
  if (!requested) return fallback;
  if (!options.some((o) => o.id === requested)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Esa cuenta no está habilitada para desembolsos (accounting.disbursementAccounts)."
    });
  }
  return requested;
}
