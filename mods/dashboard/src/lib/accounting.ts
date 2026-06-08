/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Display helpers for the accounting (contabilidad) screens. Shapes mirror the
 * backend AccountingAccount / AccountingCategory / AccountingTransaction models
 * exactly — code is the source of truth.
 */
import type { BadgeTone } from "../components/ui/Badge";

export type TransactionType = "DEPOSIT" | "WITHDRAWAL" | "EXPENSE" | "INCOME" | "TRANSFER";
export type TransactionStatus = "POSTED" | "REVERSED";
export type AccountKind = "BANK" | "CASH" | "CREDIT_CARD" | "OTHER";

/** Tab strip entries — "all" means no `type` filter. */
export const TYPE_TABS: Array<{ label: string; value: TransactionType | "all" }> = [
  { label: "Todas", value: "all" },
  { label: "Depósito", value: "DEPOSIT" },
  { label: "Retiro", value: "WITHDRAWAL" },
  { label: "Gasto", value: "EXPENSE" },
  { label: "Ingreso", value: "INCOME" },
  { label: "Transferencia", value: "TRANSFER" }
];

export const TYPE_META: Record<TransactionType, { label: string; tone: BadgeTone }> = {
  DEPOSIT: { label: "Depósito", tone: "neutral" },
  WITHDRAWAL: { label: "Retiro", tone: "neutral" },
  EXPENSE: { label: "Gasto", tone: "neutral" },
  INCOME: { label: "Ingreso", tone: "neutral" },
  TRANSFER: { label: "Transferencia", tone: "neutral" }
};

export function typeMeta(type: string): { label: string; tone: BadgeTone } {
  return TYPE_META[type as TransactionType] ?? { label: type, tone: "neutral" };
}

export const STATUS_META: Record<TransactionStatus, { label: string; tone: BadgeTone }> = {
  POSTED: { label: "Publicado", tone: "neutral" },
  REVERSED: { label: "Revertido", tone: "neutral" }
};

export function statusMeta(status: string): { label: string; tone: BadgeTone } {
  return STATUS_META[status as TransactionStatus] ?? { label: status, tone: "neutral" };
}

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  BANK: "Banco",
  CASH: "Efectivo",
  CREDIT_CARD: "Tarjeta de crédito",
  OTHER: "Otro"
};

export function accountKindMeta(kind: string): { label: string; tone: BadgeTone } {
  return { label: ACCOUNT_KIND_LABELS[kind as AccountKind] ?? kind, tone: "neutral" };
}

/** Default date range: first day of current month to today (inclusive). */
export function defaultDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    startDate: start.toISOString(),
    endDate: now.toISOString()
  };
}
