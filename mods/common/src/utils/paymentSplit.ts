/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Single source of truth for the mora-first payment split and
 * PARTIAL / COMPLETED status determination.
 *
 * Used by:
 *  - Server payment creation (createCreatePayment)
 *  - Mobile offline queue (queuePayment)
 *  - Mobile receipt / confirmation screen
 *  - Mobile cobrar breakdown preview
 */

export interface PaymentSplitInput {
  amount: number;
  expectedCuota: number;
  accruedMora: number;
  kind?: "INSTALLMENT" | "LATE_FEE";
  lateFeeOverride?: number;
  statusOverride?: "COMPLETED" | "PARTIAL";
}

export interface PaymentSplitResult {
  lateFeePortion: number;
  installmentPortion: number;
  installmentStatus: "COMPLETED" | "PARTIAL";
  rowCount: number;
}

export function computePaymentSplit(input: PaymentSplitInput): PaymentSplitResult {
  const { amount, expectedCuota, kind, statusOverride } = input;

  let lateFeePortion = 0;
  let installmentPortion = amount;

  if (kind === "LATE_FEE") {
    lateFeePortion = amount;
    installmentPortion = 0;
  } else if (kind === "INSTALLMENT") {
    lateFeePortion = 0;
    installmentPortion = amount;
  } else {
    const override = input.lateFeeOverride ?? 0;
    const suggestedMora = Math.max(0, input.accruedMora - override);
    lateFeePortion = Math.min(amount, suggestedMora);
    installmentPortion = amount - lateFeePortion;
  }

  const installmentStatus =
    statusOverride ??
    (installmentPortion > 0 && installmentPortion + 1e-9 < expectedCuota ? "PARTIAL" : "COMPLETED");

  const rowCount = (lateFeePortion > 0 ? 1 : 0) + (installmentPortion > 0 ? 1 : 0);

  return { lateFeePortion, installmentPortion, installmentStatus, rowCount };
}
