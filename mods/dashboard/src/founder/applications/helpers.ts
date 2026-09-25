/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { trpc } from "../../lib/trpc";

/** Read a picked file as base64 (no data: prefix), for the upload endpoints. */
export function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

export type Frequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  DAILY: "Diaria",
  WEEKLY: "Semanal",
  BIWEEKLY: "Quincenal",
  MONTHLY: "Mensual"
};

/** "10 cuotas semanales": the frequency as a plural adjective after "cuotas". */
export const INSTALLMENT_PLURAL: Record<Frequency, string> = {
  DAILY: "diarias",
  WEEKLY: "semanales",
  BIWEEKLY: "quincenales",
  MONTHLY: "mensuales"
};

/** Shift a date by one payment period (for the first-installment default and loan start). */
export function shiftPeriod(date: Date, frequency: Frequency, direction: 1 | -1): Date {
  const d = new Date(date);
  if (frequency === "DAILY") d.setDate(d.getDate() + direction);
  else if (frequency === "WEEKLY") d.setDate(d.getDate() + 7 * direction);
  else if (frequency === "BIWEEKLY") d.setDate(d.getDate() + 14 * direction);
  else d.setMonth(d.getMonth() + direction);
  return d;
}

export function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayDate(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** Everything that shows an application refetches after a change to it. */
export function useApplicationInvalidation() {
  const utils = trpc.useUtils();
  return (id: string) =>
    Promise.all([
      utils.getApplication.invalidate({ id }),
      utils.getApplicationEvidence.invalidate({ id }),
      utils.listFeedEvents.invalidate(),
      utils.listOpenApplicationEvents.invalidate()
    ]);
}

/** Stored contract terms, when the contract was generated here. */
export interface ContractTerms {
  installments: number;
  installmentAmount: number;
  frequency: Frequency;
  startDate: string;
}

export function contractTermsOf(app: { contractTerms?: unknown }): ContractTerms | null {
  const t = app.contractTerms as Partial<ContractTerms> | null | undefined;
  if (!t || typeof t.installments !== "number" || typeof t.installmentAmount !== "number")
    return null;
  return t as ContractTerms;
}
