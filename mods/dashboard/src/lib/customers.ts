/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Display helpers for the customers (clientes) screens. The shapes here mirror
 * the backend `Customer` / `Loan` / `Payment` models exactly — code is the
 * source of truth, so we only surface fields the procedures actually return.
 */
import type { BadgeTone } from "../components/ui/Badge";

/** Active/inactive segment tabs for the list. `showInactive` drives `listCustomers`. */
export type CustomerSegment = "active" | "all" | "inactive";

export const CUSTOMER_SEGMENTS: Array<{ label: string; value: CustomerSegment }> = [
  { label: "Activos", value: "active" },
  { label: "Todos", value: "all" },
  { label: "Inactivos", value: "inactive" }
];

/** `listCustomers` returns active-only by default; only "active" omits showInactive. */
export function segmentToShowInactive(segment: CustomerSegment): boolean | undefined {
  return segment === "active" ? undefined : true;
}

export const LOAN_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: "Activo", tone: "neutral" },
  COMPLETED: { label: "Completado", tone: "neutral" },
  DEFAULTED: { label: "En mora", tone: "red" },
  CANCELLED: { label: "Cancelado", tone: "neutral" }
};

export function loanStatusMeta(status: string): { label: string; tone: BadgeTone } {
  return LOAN_STATUS_META[status] ?? { label: status, tone: "neutral" };
}

export const PAYMENT_FREQUENCY_LABELS: Record<string, string> = {
  DAILY: "Diario",
  WEEKLY: "Semanal",
  BIWEEKLY: "Quincenal",
  MONTHLY: "Mensual"
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia"
};

export const PAYMENT_KIND_LABELS: Record<string, string> = {
  INSTALLMENT: "Cuota",
  LATE_FEE: "Mora"
};

export const DAY_OF_WEEK_LABELS: Record<string, string> = {
  MONDAY: "Lunes",
  TUESDAY: "Martes",
  WEDNESDAY: "Miércoles",
  THURSDAY: "Jueves",
  FRIDAY: "Viernes",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo"
};
