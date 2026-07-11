/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The accounting-snapshot report: a branded PDF (+ canonical JSON) for
 * account balances and the period's transaction ledger.
 *
 * Input mirrors the pre-migration `AccountingReportData` shape
 * (`mods/common/src/reports/types.ts`) field-for-field, kept DB-free and
 * self-contained here (the apiserver already resolves the DB via Prisma and
 * maps rows into this shape; no LLM/narrative text is involved in this
 * report, unlike performance/defaulted/renewal).
 */
import { z } from "zod/v4";
import { defineReport, type Report } from "./report.js";
import {
  brandHeader,
  kpiGrid,
  dataTable,
  section,
  footerNote,
  page,
  paginateRows,
  TABLE_ROWS_CONTINUATION_PAGE,
  type KpiCell,
  type TableRow,
  type TableColumn,
  type ReportElement
} from "./blocks.js";
import type { ReportDocument } from "./renderer.js";
import { formatDop, formatDateEs } from "./format.js";

// ==================== Input schema (DB-free, mirrors AccountingReportData) ====================

const accountingReportAccountInputSchema = z.object({
  name: z.string(),
  kind: z.string(),
  currency: z.string(),
  currentBalance: z.number()
});

const accountingReportTransactionInputSchema = z.object({
  occurredAt: z.coerce.date(),
  type: z.string(),
  accountName: z.string(),
  categoryName: z.string().nullish(),
  vendor: z.string().nullish(),
  description: z.string().nullish(),
  amount: z.number()
});

export const accountingReportInputSchema = z.object({
  period: z.object({ startDate: z.string(), endDate: z.string() }),
  accounts: z.array(accountingReportAccountInputSchema),
  transactions: z.array(accountingReportTransactionInputSchema),
  totals: z.object({
    totalIncome: z.number(),
    totalExpenses: z.number(),
    netFlow: z.number(),
    combinedBalance: z.number()
  }),
  generatedAt: z.coerce.date().optional()
});

export type AccountingReportInput = z.infer<typeof accountingReportInputSchema>;

// ==================== Canonical data model ====================

export interface AccountingReportAccountRow {
  name: string;
  kind: string;
  currency: string;
  currentBalance: number;
}

export interface AccountingReportTransactionRow {
  occurredAt: string;
  type: string;
  accountName: string;
  categoryName: string | null;
  vendor: string | null;
  description: string | null;
  amount: number;
}

/** The full typed accounting-report data model — canonical; the PDF adds no new data. */
export interface AccountingReportSnapshot {
  generatedAt: string;
  period: { startDate: string; endDate: string };
  accounts: AccountingReportAccountRow[];
  transactions: AccountingReportTransactionRow[];
  totals: {
    totalIncome: number;
    totalExpenses: number;
    netFlow: number;
    combinedBalance: number;
  };
}

/** Build the canonical accounting-report data model from validated input. */
export function buildAccountingReportData(input: AccountingReportInput): AccountingReportSnapshot {
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();

  return {
    generatedAt,
    period: input.period,
    accounts: input.accounts.map((a) => ({
      name: a.name,
      kind: a.kind,
      currency: a.currency,
      currentBalance: a.currentBalance
    })),
    transactions: input.transactions.map((t) => ({
      occurredAt: t.occurredAt.toISOString(),
      type: t.type,
      accountName: t.accountName,
      categoryName: t.categoryName ?? null,
      vendor: t.vendor ?? null,
      description: t.description ?? null,
      amount: t.amount
    })),
    totals: input.totals
  };
}

// ==================== Presentation (page composition) ====================

const ACCOUNT_KIND_LABELS: Record<string, string> = {
  BANK: "Banco",
  CASH: "Efectivo",
  CREDIT_CARD: "Tarjeta",
  OTHER: "Otro"
};

const TXN_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "Depósito",
  WITHDRAWAL: "Retiro",
  EXPENSE: "Gasto",
  INCOME: "Ingreso",
  TRANSFER: "Transferencia"
};

const TXN_TYPE_TONES: Record<string, "paid" | "overdue" | "info" | "partial" | "upcoming"> = {
  INCOME: "paid",
  EXPENSE: "overdue",
  DEPOSIT: "info",
  WITHDRAWAL: "partial",
  TRANSFER: "upcoming"
};

function buildKpiCells(data: AccountingReportSnapshot): KpiCell[] {
  const { totals } = data;
  return [
    { label: "Ingresos", value: formatDop(totals.totalIncome) },
    { label: "Gastos", value: formatDop(totals.totalExpenses), emphasize: true },
    { label: "Flujo neto", value: formatDop(totals.netFlow) },
    { label: "Balance total", value: formatDop(totals.combinedBalance) }
  ];
}

function buildBalanceRows(data: AccountingReportSnapshot): TableRow[] {
  const rows: TableRow[] = data.accounts.map((a) => ({
    cells: {
      cuenta: a.name,
      tipo: ACCOUNT_KIND_LABELS[a.kind] ?? a.kind,
      balance: formatDop(a.currentBalance)
    }
  }));
  rows.push({
    cells: { cuenta: "Total", tipo: "", balance: formatDop(data.totals.combinedBalance) }
  });
  return rows;
}

function buildTransactionRows(data: AccountingReportSnapshot): TableRow[] {
  return data.transactions.map((t) => ({
    cells: {
      fecha: formatDateEs(t.occurredAt),
      tipo: "",
      cuenta: t.accountName,
      categoria: t.categoryName ?? "—",
      monto: formatDop(t.amount)
    },
    status: {
      column: "tipo",
      value: TXN_TYPE_LABELS[t.type] ?? t.type,
      tone: TXN_TYPE_TONES[t.type] ?? "upcoming"
    }
  }));
}

const BALANCE_COLUMNS: TableColumn[] = [
  { key: "cuenta", header: "Cuenta", weight: 1.6 },
  { key: "tipo", header: "Tipo", weight: 1 },
  { key: "balance", header: "Balance (DOP)", weight: 1.2, align: "right" }
];

const TRANSACTION_COLUMNS: TableColumn[] = [
  { key: "fecha", header: "Fecha", weight: 0.9 },
  { key: "tipo", header: "Tipo", weight: 1 },
  { key: "cuenta", header: "Cuenta", weight: 1.3 },
  { key: "categoria", header: "Categoría", weight: 1.2 },
  { key: "monto", header: "Monto (DOP)", weight: 1.1, align: "right" }
];

/**
 * Rows of the movimientos table that fit alongside the balance table on page
 * 1, on top of brandHeader + kpiGrid — well under
 * {@link TABLE_ROWS_FIRST_PAGE}'s margin to leave room for the (always
 * small, but non-zero) balance table above it.
 */
const TRANSACTIONS_ON_PAGE_1 = 15;

/**
 * Compose the accounting-report document from the canonical data model.
 * Balance rows are bounded by account count (always small) and stay on page
 * 1 alongside the first chunk of movements; a long period's movements table
 * can grow large, so any rows beyond page 1's budget spill onto continuation
 * pages (see {@link paginateRows} — same overflow/crash class as issue #202).
 */
export function buildAccountingReportDocument(data: AccountingReportSnapshot): ReportDocument {
  const meta = [
    `Generado ${formatDateEs(data.generatedAt)}`,
    `Periodo ${data.period.startDate} — ${data.period.endDate}`
  ];

  const txnRowPages = paginateRows(
    buildTransactionRows(data),
    TRANSACTIONS_ON_PAGE_1,
    TABLE_ROWS_CONTINUATION_PAGE
  );
  const totalPages = txnRowPages.length;

  const pages = txnRowPages.map((rows, i) => {
    const isFirst = i === 0;
    const isLast = i === totalPages - 1;
    const children: ReportElement[] = [];

    if (isFirst) {
      children.push(
        brandHeader({
          title: "Reporte Contable",
          subtitle: "Balance de cuentas y movimientos del periodo",
          meta
        }),
        kpiGrid({ cells: buildKpiCells(data), columns: 4 }),
        section("Balance de cuentas", [
          dataTable({ columns: BALANCE_COLUMNS, rows: buildBalanceRows(data) })
        ])
      );
    }

    children.push(
      section(totalPages > 1 ? `Movimientos (${i + 1}/${totalPages})` : "Movimientos", [
        dataTable({ columns: TRANSACTION_COLUMNS, rows })
      ])
    );

    if (isLast) {
      children.push(
        footerNote([
          `Reporte contable · Generado ${formatDateEs(data.generatedAt)} · Documento generado automáticamente por Mikro.`
        ])
      );
    }

    return { layout: page(children) };
  });

  return { pages };
}

/** The accounting report: validated account balances + transactions in, JSON/PDF out. */
export const accountingReport: Report<AccountingReportSnapshot> = defineReport({
  name: "accounting",
  inputSchema: accountingReportInputSchema,
  buildData: buildAccountingReportData,
  toDocument: buildAccountingReportDocument
});
