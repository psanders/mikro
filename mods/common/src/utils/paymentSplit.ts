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
  /**
   * Money still needed to bring the currently open cuota to full coverage.
   * Partials accumulate, so a cuota already half-covered needs less than a full
   * cuota to close. Omit (or pass <= 0) for a fresh cuota, which needs
   * `expectedCuota`. Drives PARTIAL vs COMPLETED — without it, a payment that
   * finishes a half-covered cuota is mislabelled PARTIAL.
   */
  cuotaRemaining?: number;
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

  // A cuota already carrying accumulated partials closes on less than a full
  // cuota; only a fresh one needs the whole thing.
  const remainingToClose =
    input.cuotaRemaining != null && input.cuotaRemaining > 0
      ? Math.min(input.cuotaRemaining, expectedCuota)
      : expectedCuota;

  const installmentStatus =
    statusOverride ??
    (installmentPortion > 0 && installmentPortion + 1e-9 < remainingToClose
      ? "PARTIAL"
      : "COMPLETED");

  const rowCount = (lateFeePortion > 0 ? 1 : 0) + (installmentPortion > 0 ? 1 : 0);

  return { lateFeePortion, installmentPortion, installmentStatus, rowCount };
}
