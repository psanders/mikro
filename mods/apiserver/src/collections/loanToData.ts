/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Map a loan row (with payments) to LoanPaymentData for getMissedPaymentsCount.
 */
import type { LoanPaymentData } from "@mikro/common";

export function loanToData(
  loan: {
    paymentFrequency: string;
    createdAt: Date;
    startingDate?: Date | null;
    payments: Array<{ paidAt: Date }>;
  },
  preferredPaymentDay?: string | null
): LoanPaymentData {
  return {
    paymentFrequency: loan.paymentFrequency,
    createdAt: loan.createdAt,
    startingDate: loan.startingDate ?? undefined,
    payments: loan.payments.map((p) => ({ paidAt: p.paidAt })),
    preferredPaymentDay: preferredPaymentDay ?? undefined
  };
}
