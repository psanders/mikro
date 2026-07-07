/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared helpers used by mora-aware callers (payment creation, preview, export).
 */
import type { LoanPaymentData } from "./calculatePaymentStatus.js";
import type { CollectedLateFeePayment } from "./lateFee.js";

/**
 * Prisma Decimal / BigInt / number — coerce to plain number.
 * Handles Prisma's Decimal (which has .toString()) as well as raw numbers.
 */
export function amountToNumber(amount: unknown): number {
  if (typeof amount === "number") return amount;
  if (amount && typeof amount === "object" && "toString" in amount) {
    return Number((amount as { toString: () => string }).toString());
  }
  return Number(amount);
}

export interface LoanWithPaymentsForMora {
  paymentFrequency: string;
  createdAt: Date;
  startingDate: Date | null;
  termLength: number;
  /** Cuota size. When present (with payment amounts), cycle counting is money-based. */
  paymentAmount?: unknown;
  payments: Array<{
    paidAt: Date;
    status: string;
    kind?: string | null;
    amount?: unknown;
  }>;
  customer: { preferredPaymentDay: string | null };
}

/**
 * Convert a Prisma loan (with joined payments and customer) into the
 * `LoanPaymentData` shape consumed by `getCycleMetrics` / `computeAccruedMora`.
 *
 * Only INSTALLMENT payments are included — LATE_FEE rows must not
 * affect cycle counts or arrears calculations. Payment amounts and the cuota
 * are passed through so cycle counting is money-based (partials accumulate).
 */
export function toLoanPaymentData(loan: LoanWithPaymentsForMora): LoanPaymentData {
  const installmentPayments = loan.payments.filter((p) => !p.kind || p.kind === "INSTALLMENT");
  return {
    paymentFrequency: loan.paymentFrequency,
    createdAt: new Date(loan.createdAt),
    startingDate: loan.startingDate != null ? new Date(loan.startingDate) : null,
    termLength: loan.termLength,
    paymentAmount: loan.paymentAmount != null ? amountToNumber(loan.paymentAmount) : undefined,
    payments: installmentPayments.map((p) => ({
      paidAt: new Date(p.paidAt),
      status: p.status,
      amount: p.amount != null ? amountToNumber(p.amount) : undefined
    })),
    preferredPaymentDay: loan.customer.preferredPaymentDay ?? null
  };
}

/**
 * Non-reversed LATE_FEE rows for `computeAccruedMora` net mora calculation.
 */
export function toCollectedLateFeePayments(
  loan: LoanWithPaymentsForMora
): CollectedLateFeePayment[] {
  return loan.payments
    .filter((p) => p.kind === "LATE_FEE" && p.status !== "REVERSED")
    .map((p) => ({
      paidAt: new Date(p.paidAt),
      amount: p.amount != null ? amountToNumber(p.amount) : 0,
      status: p.status
    }));
}
