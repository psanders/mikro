/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Turns the Ops app's loan calculator inputs (raw text as typed) into loan
 * options. Same `priceLoanOptions` the server uses, on the pricing it serves
 * (`getLoanPricing`); this only parses the text and names the first bad field
 * in Spanish, so the panel can show an inline message instead of a table.
 */
import { calculateLoanSchema, type PaymentFrequency } from "../schemas/loan.js";
import {
  priceLoanOptions,
  type CalculateLoanResult,
  type LoanPricing,
  type PriceLoanParams
} from "./calculateLoan.js";

export interface LoanCalculatorForm {
  /** RD$, may include thousands separators ("10,000"). */
  principal: string;
  paymentFrequency: PaymentFrequency;
  /** Whole periods of `paymentFrequency`. */
  baseDuration: string;
}

export type LoanCalculatorFieldError = {
  ok: false;
  field: keyof LoanCalculatorForm;
  message: string;
};

export type LoanCalculatorOutcome =
  { ok: true; result: CalculateLoanResult } | LoanCalculatorFieldError;

function toNumber(text: string): number {
  const cleaned = text.replace(/[,\s]/g, "");
  return cleaned === "" ? NaN : Number(cleaned);
}

/**
 * Checks the fields alone, so the panel can show a field error before the
 * pricing has loaded.
 */
export function parseLoanCalculatorForm(
  form: LoanCalculatorForm
): { ok: true; params: PriceLoanParams } | LoanCalculatorFieldError {
  const principal = toNumber(form.principal);
  if (!(principal > 0)) {
    return { ok: false, field: "principal", message: "Ingresa un monto mayor que cero." };
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
  return { ok: true, params: parsed.data };
}

export function calculateFromForm(
  form: LoanCalculatorForm,
  pricing: LoanPricing
): LoanCalculatorOutcome {
  const parsed = parseLoanCalculatorForm(form);
  return parsed.ok ? { ok: true, result: priceLoanOptions(parsed.params, pricing) } : parsed;
}
