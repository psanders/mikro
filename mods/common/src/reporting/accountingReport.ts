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
import { composeReportPages } from "./compose.js";
import {
  brandHeader,
  kpiGrid,
  dataTable,
  section,
  paginateRows,
  type KpiCell,
  type TableRow,
  type TableColumn,
  type ReportElement,
  type CellVariant
} from "./blocks.js";
import {
  headerHeight,
  kpiGridHeight,
  tableRowBudget,
  SECTION_TITLE_HEIGHT,
  TABLE_HEADER_HEIGHT,
  TABLE_ROW_HEIGHT,
  TABLE_CARD_BORDER_PX
} from "./layout.js";
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

/** Money-out transaction types render with a leading "−" and the emphasis (orange) money treatment. */
const OUTFLOW_TYPES = new Set(["EXPENSE", "WITHDRAWAL"]);

/** Month + year, e.g. "Julio 2026" — the Pencil header's "Período" meta value; purely a display of `period.startDate`. */
function formatMonthYearEs(d: string): string {
  const label = new Date(`${d}T00:00:00Z`).toLocaleDateString("es-DO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildKpiCells(data: AccountingReportSnapshot): KpiCell[] {
  const { totals } = data;
  return [
    { label: "Ingresos", value: formatDop(totals.totalIncome) },
    { label: "Gastos", value: formatDop(totals.totalExpenses), emphasize: true },
    { label: "Flujo neto", value: formatDop(totals.netFlow) },
    {
      label: "Balance total",
      value: formatDop(totals.combinedBalance),
      subtext: `${data.accounts.length} cuenta${data.accounts.length === 1 ? "" : "s"}`
    }
  ];
}

function buildBalanceRows(data: AccountingReportSnapshot): TableRow[] {
  return data.accounts.map((a) => ({
    cells: {
      cuenta: a.name,
      tipo: ACCOUNT_KIND_LABELS[a.kind] ?? a.kind,
      balance: formatDop(a.currentBalance)
    }
  }));
}

function buildTransactionRows(data: AccountingReportSnapshot): TableRow[] {
  return data.transactions.map((t) => {
    const isOutflow = OUTFLOW_TYPES.has(t.type);
    const montoVariant: CellVariant = isOutflow ? "moneyEmphasis" : "money";
    return {
      cells: {
        fecha: formatDateEs(t.occurredAt),
        tipo: "",
        cuenta: t.accountName,
        categoria: t.categoryName ?? "—",
        monto: `${isOutflow ? "−" : ""}${formatDop(Math.abs(t.amount))}`
      },
      status: {
        column: "tipo",
        value: TXN_TYPE_LABELS[t.type] ?? t.type,
        tone: TXN_TYPE_TONES[t.type] ?? "upcoming"
      },
      cellVariants: { monto: montoVariant }
    };
  });
}

const BALANCE_COLUMNS: TableColumn[] = [
  { key: "cuenta", header: "Cuenta", weight: 1.6, variant: "primary" },
  { key: "tipo", header: "Tipo", weight: 1, variant: "secondary" },
  { key: "balance", header: "Balance (DOP)", weight: 1.2, align: "right", variant: "money" }
];

const TRANSACTION_COLUMNS: TableColumn[] = [
  { key: "fecha", header: "Fecha", weight: 0.9, variant: "secondary" },
  { key: "tipo", header: "Tipo", weight: 1 },
  { key: "cuenta", header: "Cuenta", weight: 1.3, variant: "secondary" },
  { key: "categoria", header: "Categoría", weight: 1.2, variant: "secondary" },
  { key: "monto", header: "Monto (DOP)", weight: 1.1, align: "right" }
];

/**
 * Compose the accounting-report document from the canonical data model.
 * Balance rows are bounded by account count (always small) and stay on page
 * 1 alongside the first chunk of movements; a long period's movements table
 * can grow large, so any rows beyond page 1's budget spill onto continuation
 * pages (see `layout.ts`'s `tableRowBudget` — the balance table's own
 * height, computed from its real row count, is folded in as one of the
 * "blocks above" the movimientos table on page 1).
 */
export function buildAccountingReportDocument(data: AccountingReportSnapshot): ReportDocument {
  const meta = [
    { label: "Generado", value: formatDateEs(data.generatedAt) },
    { label: "Período", value: formatMonthYearEs(data.period.startDate) }
  ];

  const balanceRows = buildBalanceRows(data);
  const balanceTableHeight =
    SECTION_TITLE_HEIGHT +
    TABLE_HEADER_HEIGHT +
    balanceRows.length * TABLE_ROW_HEIGHT +
    TABLE_CARD_BORDER_PX;

  const firstPageAbove = [headerHeight(meta.length), kpiGridHeight(1, true), balanceTableHeight];
  const txnRowPages = paginateRows(
    buildTransactionRows(data),
    tableRowBudget({ aboveHeights: firstPageAbove }),
    tableRowBudget({ includeSectionTitle: false })
  );

  const pageBodies: ReportElement[][] = txnRowPages.map((rows, i) => {
    const body: ReportElement[] = [];

    if (i === 0) {
      body.push(
        brandHeader({
          eyebrow: "Reporte",
          title: "Reporte Contable",
          subtitle: "Ingresos, gastos y balances del período",
          meta
        }),
        kpiGrid({ cells: buildKpiCells(data), columns: 4 }),
        section("Balance de cuentas", [dataTable({ columns: BALANCE_COLUMNS, rows: balanceRows })]),
        section("Movimientos del período", [dataTable({ columns: TRANSACTION_COLUMNS, rows })])
      );
    } else {
      body.push(dataTable({ columns: TRANSACTION_COLUMNS, rows }));
    }

    return body;
  });

  const footerContext = `Mikro SRL — Reporte contable · Generado ${formatDateEs(data.generatedAt)}`;
  return composeReportPages(pageBodies, () => [footerContext]);
}

/** The accounting report: validated account balances + transactions in, JSON/PDF out. */
export const accountingReport: Report<AccountingReportSnapshot> = defineReport({
  name: "accounting",
  inputSchema: accountingReportInputSchema,
  buildData: buildAccountingReportData,
  toDocument: buildAccountingReportDocument
});
