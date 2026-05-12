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
    payments: Array<{ paidAt: Date; status?: string; kind?: string }>;
  },
  preferredPaymentDay?: string | null
): LoanPaymentData {
  const installmentPayments = loan.payments.filter((p) => !p.kind || p.kind === "INSTALLMENT");
  return {
    paymentFrequency: loan.paymentFrequency,
    createdAt: loan.createdAt,
    startingDate: loan.startingDate ?? undefined,
    payments: installmentPayments.map((p) => ({
      paidAt: p.paidAt,
      ...(p.status !== undefined ? { status: p.status } : {})
    })),
    preferredPaymentDay: preferredPaymentDay ?? undefined
  };
}
