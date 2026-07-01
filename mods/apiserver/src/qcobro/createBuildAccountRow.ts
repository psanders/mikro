/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Builds one QCobro `AccountRow` from a customer's current state. `principalAmount`/
 * `termsAmount`/`termsFrequency`/`termsLength` come from the customer's worst loan
 * (the same one driving status:/dpd: — see createComputeCustomerTags.ts); a
 * customer's several loans can have different frequencies, so a single row can't
 * represent more than one "primary" set of terms. `outstandingBalance` is the only
 * figure summed across all relevant loans (via computeCustomerBalance), matching
 * QCOBRO.md's documented balance-basis behavior.
 */
import { amountToNumber } from "@mikro/common";
import type { ComputedCustomerTags } from "../tags/createComputeCustomerTags.js";
import type { AccountRow } from "./createQCobroClient.js";
import type { LoanForBalance } from "./createComputeBalance.js";

export interface CustomerForAccountRow {
  id: string;
  name: string;
  phone: string;
}

export interface LastPaymentForAccountRow {
  paidAt: Date;
  amount: unknown;
}

export function buildAccountRow(
  customer: CustomerForAccountRow,
  loans: LoanForBalance[],
  computed: ComputedCustomerTags,
  outstandingBalance: number,
  lastPayment: LastPaymentForAccountRow | null
): AccountRow {
  const worstLoan = computed.worstLoanId
    ? loans.find((l) => l.id === computed.worstLoanId)
    : undefined;

  return {
    externalId: customer.id,
    fullName: customer.name,
    phone: customer.phone,
    principalAmount: worstLoan ? amountToNumber(worstLoan.principal) : undefined,
    termsAmount: worstLoan ? amountToNumber(worstLoan.paymentAmount) : undefined,
    termsFrequency: worstLoan?.paymentFrequency,
    termsLength: worstLoan?.termLength,
    outstandingBalance,
    daysPastDue: computed.daysPastDue,
    missedInstallments: computed.missedInstallments,
    lastPaymentDate: lastPayment ? lastPayment.paidAt.toISOString() : undefined,
    lastPaymentAmount: lastPayment ? amountToNumber(lastPayment.amount) : undefined
  };
}
