/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Turns the Ops app's loan calculator inputs (raw text as typed) into loan
 * options. Same `calculateLoanOptions` the server uses; this only parses the
 * text, converts the percent to a rate and names the first bad field in
 * Spanish, so the panel can show an inline message instead of a table.
 */
import { calculateLoanSchema, type PaymentFrequency } from "../schemas/loan.js";
import { calculateLoanOptions, type CalculateLoanResult } from "./calculateLoan.js";

export interface LoanCalculatorForm {
  /** RD$, may include thousands separators ("10,000"). */
  principal: string;
  /** Total interest as a percent ("30" = 30%). */
  ratePercent: string;
  paymentFrequency: PaymentFrequency;
  /** Whole periods of `paymentFrequency`. */
  baseDuration: string;
}

export type LoanCalculatorOutcome =
  | { ok: true; result: CalculateLoanResult }
  | { ok: false; field: keyof LoanCalculatorForm; message: string };

function toNumber(text: string): number {
  const cleaned = text.replace(/[,\s]/g, "");
  return cleaned === "" ? NaN : Number(cleaned);
}

export function calculateFromForm(form: LoanCalculatorForm): LoanCalculatorOutcome {
  const principal = toNumber(form.principal);
  if (!(principal > 0)) {
    return { ok: false, field: "principal", message: "Ingresa un monto mayor que cero." };
  }

  const ratePercent = toNumber(form.ratePercent);
  if (!(ratePercent > 0) || ratePercent > 100) {
    return { ok: false, field: "ratePercent", message: "La tasa debe estar entre 0% y 100%." };
  }

  const baseDuration = toNumber(form.baseDuration);
  if (!Number.isInteger(baseDuration) || baseDuration < 1) {
    return {
      ok: false,
      field: "baseDuration",
      message: "El plazo debe ser un número entero de períodos."
    };
  }

  // Backstop for what the checks above let through (e.g. "1e999" → Infinity):
  // never throw from here, the panel calls this during render.
  const parsed = calculateLoanSchema.safeParse({
    principal,
    interestRate: ratePercent / 100,
    paymentFrequency: form.paymentFrequency,
    baseDuration
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return {
      ok: false,
      field: field === "baseDuration" ? "baseDuration" : "principal",
      message: "Revisa los valores: alguno está fuera de rango."
    };
  }
  return { ok: true, result: calculateLoanOptions(parsed.data) };
}
