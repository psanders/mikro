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
  type KpiCell,
  type TableRow
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

/** Compose the 1-page accounting-report document from the canonical data model. */
export function buildAccountingReportDocument(data: AccountingReportSnapshot): ReportDocument {
  const meta = [
    `Generado ${formatDateEs(data.generatedAt)}`,
    `Periodo ${data.period.startDate} — ${data.period.endDate}`
  ];

  const p1 = page([
    brandHeader({
      title: "Reporte Contable",
      subtitle: "Balance de cuentas y movimientos del periodo",
      meta
    }),
    kpiGrid({ cells: buildKpiCells(data), columns: 4 }),
    section("Balance de cuentas", [
      dataTable({
        columns: [
          { key: "cuenta", header: "Cuenta", weight: 1.6 },
          { key: "tipo", header: "Tipo", weight: 1 },
          { key: "balance", header: "Balance (DOP)", weight: 1.2, align: "right" }
        ],
        rows: buildBalanceRows(data)
      })
    ]),
    section("Movimientos", [
      dataTable({
        columns: [
          { key: "fecha", header: "Fecha", weight: 0.9 },
          { key: "tipo", header: "Tipo", weight: 1 },
          { key: "cuenta", header: "Cuenta", weight: 1.3 },
          { key: "categoria", header: "Categoría", weight: 1.2 },
          { key: "monto", header: "Monto (DOP)", weight: 1.1, align: "right" }
        ],
        rows: buildTransactionRows(data)
      })
    ]),
    footerNote([
      `Reporte contable · Generado ${formatDateEs(data.generatedAt)} · Documento generado automáticamente por Mikro.`
    ])
  ]);

  return { pages: [{ layout: p1 }] };
}

/** The accounting report: validated account balances + transactions in, JSON/PDF out. */
export const accountingReport: Report<AccountingReportSnapshot> = defineReport({
  name: "accounting",
  inputSchema: accountingReportInputSchema,
  buildData: buildAccountingReportData,
  toDocument: buildAccountingReportDocument
});
