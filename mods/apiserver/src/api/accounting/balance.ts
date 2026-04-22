/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Sign conventions that translate a Transaction type + amount into balance deltas.
 */
import type { TransactionType } from "@mikro/common";

export interface BalanceDeltas {
  /** Signed delta applied to the primary account. */
  account: number;
  /** Signed delta applied to the secondary account (only set for TRANSFER). */
  toAccount?: number;
}

/**
 * Returns the signed deltas to apply to account balances when posting a transaction.
 *
 *   DEPOSIT  / INCOME  : account += amount
 *   WITHDRAWAL / EXPENSE: account -= amount
 *   TRANSFER            : fromAccount -= amount, toAccount += amount
 */
export function deltasForPost(type: TransactionType, amount: number): BalanceDeltas {
  switch (type) {
    case "DEPOSIT":
    case "INCOME":
      return { account: amount };
    case "WITHDRAWAL":
    case "EXPENSE":
      return { account: -amount };
    case "TRANSFER":
      return { account: -amount, toAccount: amount };
  }
}

/** Returns the inverse deltas to apply when reversing a previously posted transaction. */
export function deltasForReverse(type: TransactionType, amount: number): BalanceDeltas {
  const posted = deltasForPost(type, amount);
  return {
    account: -posted.account,
    ...(posted.toAccount !== undefined ? { toAccount: -posted.toAccount } : {})
  };
}
