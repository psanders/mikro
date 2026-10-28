/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { PaymentFrequency } from "@mikro/common/utils/calculateLoan";
import type { LoanDueDateFields } from "@mikro/common/utils/dueDates";

/** The synced loan row's date fields, as stored in local SQLite (ISO strings). */
export interface LocalLoanDates {
  /** Raw `first_due_date`; null for legacy loans or an older server. */
  firstDueDate: string | null;
  startingDate: string | null;
  createdAt: string;
  paymentFrequency: string;
}

/**
 * Inputs for `getLoanDueDate`. `firstDueDate` always comes from the row, never
 * from the snapshot's `terms.firstDueDate`: that one is already resolved, and
 * passing it would lose the legacy MONTHLY anchor day. The other fields prefer
 * the snapshot's terms when there is one.
 */
export function loanDueDateFields(
  row: LocalLoanDates | undefined,
  terms?: Omit<LocalLoanDates, "firstDueDate">
): LoanDueDateFields | null {
  if (!row) return null;
  const source = terms ?? row;
  return {
    firstDueDate: row.firstDueDate ? new Date(row.firstDueDate) : null,
    startingDate: source.startingDate ? new Date(source.startingDate) : null,
    createdAt: new Date(source.createdAt),
    paymentFrequency: source.paymentFrequency as PaymentFrequency
  };
}
