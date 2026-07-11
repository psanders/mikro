/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The customers report: a branded PDF (+ canonical JSON) grouping every
 * active loan by payment health (Crítico / Requiere atención / Al día).
 *
 * Input mirrors `CustomerForGrouping[]` — the near-raw customer+loan+payment
 * shape the pre-migration PNG generator already consumed (apiserver maps
 * Prisma rows into this shape; no DB access happens here). The health
 * grouping/rating itself reuses the existing, already-tested
 * `buildGroupedCustomerRows` helper (`utils/customerReportGrouping.ts`) — this
 * definition does not reimplement that business logic, only normalizes its
 * output into the canonical report model and lays it out.
 */
import { z } from "zod/v4";
import {
  buildGroupedCustomerRows,
  type CustomerForGrouping
} from "../utils/customerReportGrouping.js";
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
  type ReportElement
} from "./blocks.js";
import { headerHeight, kpiGridHeight, tableRowBudget } from "./layout.js";
import type { ReportDocument } from "./renderer.js";
import { formatDateEs } from "./format.js";

// ==================== Input schema (DB-free, mirrors CustomerForGrouping) ====================

const groupingPaymentInputSchema = z.object({
  paidAt: z.coerce.date(),
  status: z.string().optional(),
  amount: z.number().optional()
});

const loanForGroupingInputSchema = z.object({
  loanId: z.number().int().positive(),
  paymentFrequency: z.string(),
  createdAt: z.coerce.date(),
  startingDate: z.coerce.date().nullish(),
  termLength: z.number().int().positive(),
  paymentAmount: z.number().positive().optional(),
  payments: z.array(groupingPaymentInputSchema),
  nickname: z.string().nullish()
});

const customerForGroupingInputSchema = z.object({
  name: z.string(),
  nickname: z.string().nullish(),
  phone: z.string(),
  preferredPaymentDay: z.string().nullish(),
  loans: z.array(loanForGroupingInputSchema)
});

export const customersReportInputSchema = z.object({
  customers: z.array(customerForGroupingInputSchema),
  /** Evaluation date for payment-health grouping; defaults to now. */
  asOf: z.coerce.date().optional(),
  generatedAt: z.coerce.date().optional()
});

export type CustomersReportInput = z.infer<typeof customersReportInputSchema>;

// ==================== Canonical data model ====================

export type CustomerHealth = "critico" | "requiereAtencion" | "alDia";

export interface CustomerReportRow {
  name: string;
  nickname: string | null;
  phone: string;
  loanId: number;
  paymentFrequency: string;
  paymentsMade: number;
  termLength: number;
  rating: 1 | 2 | 3 | 4 | 5;
  health: CustomerHealth;
}

/** The full typed customers-report data model — canonical; the PDF adds no new data. */
export interface CustomersReportData {
  generatedAt: string;
  activeCustomers: number;
  totalLoans: number;
  criticoCount: number;
  requiereAtencionCount: number;
  alDiaCount: number;
  /** Sorted worst-first: Crítico, then Requiere atención, then Al día. */
  rows: CustomerReportRow[];
}

/** Build the canonical customers-report data model from validated input. */
export function buildCustomersReportData(input: CustomersReportInput): CustomersReportData {
  const asOf = input.asOf ?? new Date();
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();

  const grouped = buildGroupedCustomerRows(input.customers as CustomerForGrouping[], asOf);

  const toRow =
    (health: CustomerHealth) =>
    (r: (typeof grouped)["critico"][number]): CustomerReportRow => ({
      name: r.name,
      nickname: r.nickname ? r.nickname : null,
      phone: r.phone,
      loanId: r.loanId,
      paymentFrequency: r.paymentFrequency,
      paymentsMade: r.paymentsMade,
      termLength: r.termLength,
      rating: r.rating,
      health
    });

  const rows: CustomerReportRow[] = [
    ...grouped.critico.map(toRow("critico")),
    ...grouped.requiereAtencion.map(toRow("requiereAtencion")),
    ...grouped.alDia.map(toRow("alDia"))
  ];

  return {
    generatedAt,
    activeCustomers: input.customers.length,
    totalLoans: rows.length,
    criticoCount: grouped.critico.length,
    requiereAtencionCount: grouped.requiereAtencion.length,
    alDiaCount: grouped.alDia.length,
    rows
  };
}

// ==================== Presentation (page composition) ====================

const HEALTH_LABELS: Record<CustomerHealth, string> = {
  critico: "Crítico",
  requiereAtencion: "Requiere atención",
  alDia: "Al día"
};

const HEALTH_TONES: Record<CustomerHealth, "overdue" | "partial" | "paid"> = {
  critico: "overdue",
  requiereAtencion: "partial",
  alDia: "paid"
};

function buildKpiCells(data: CustomersReportData): KpiCell[] {
  const criticoPct =
    data.activeCustomers > 0 ? (data.criticoCount / data.activeCustomers) * 100 : 0;
  return [
    { label: "Clientes activos", value: `${data.activeCustomers}` },
    {
      label: "Crítico",
      value: `${data.criticoCount}`,
      subtext: `${criticoPct.toFixed(1)}% de la cartera`,
      emphasize: true
    },
    { label: "Requiere atención", value: `${data.requiereAtencionCount}` },
    { label: "Al día", value: `${data.alDiaCount}` }
  ];
}

function buildRows(data: CustomersReportData): TableRow[] {
  return data.rows.map((r) => ({
    cells: {
      nombre: r.name,
      telefono: r.phone,
      prestamo: `#${r.loanId}`,
      // "Ciclo" is the cuota-progress fraction (data has no distinct
      // cycle-vs-payment concept beyond `paymentsMade`/`termLength`); "Pagos"
      // is the plain count of that same figure — two views of one datum, not
      // two new fields.
      ciclo: `${Math.min(r.paymentsMade, r.termLength)} / ${r.termLength}`,
      pagos: `${r.paymentsMade}`,
      estado: ""
    },
    status: { column: "estado", value: HEALTH_LABELS[r.health], tone: HEALTH_TONES[r.health] }
  }));
}

const TABLE_COLUMNS: TableColumn[] = [
  { key: "nombre", header: "Nombre", weight: 1.7, variant: "primary" },
  { key: "telefono", header: "Teléfono", weight: 1.1, variant: "secondary" },
  { key: "prestamo", header: "Préstamo", weight: 0.8, align: "right", variant: "secondary" },
  { key: "ciclo", header: "Ciclo", weight: 0.8, variant: "secondary" },
  { key: "pagos", header: "Pagos", weight: 0.7, align: "right", variant: "secondary" },
  { key: "estado", header: "Estado", weight: 1.2 }
];

/**
 * Compose the customers-report document from the canonical data model.
 * Usually 1 page; the customer table paginates when it overflows a fixed
 * page (see `layout.ts`'s `tableRowBudget` — the fix for issue #201, where
 * only the first page's worth of customers ever showed up in the PDF; the
 * rest silently overflowed past the visible page).
 */
export function buildCustomersReportDocument(data: CustomersReportData): ReportDocument {
  const meta = [
    { label: "Generado", value: formatDateEs(data.generatedAt) },
    { label: "Total", value: `${data.activeCustomers} clientes` }
  ];

  const firstPageAbove = [headerHeight(meta.length), kpiGridHeight(1, true)];
  const rowPages = paginateRows(
    buildRows(data),
    tableRowBudget({ aboveHeights: firstPageAbove }),
    tableRowBudget({ includeSectionTitle: false })
  );

  const pageBodies: ReportElement[][] = rowPages.map((rows, i) => {
    const body: ReportElement[] = [];
    if (i === 0) {
      body.push(
        brandHeader({
          eyebrow: "Reporte",
          title: "Reporte de Clientes",
          subtitle: "Cartera de clientes por estado de salud",
          meta
        }),
        kpiGrid({ cells: buildKpiCells(data), columns: 4 }),
        section("Clientes por estado", [dataTable({ columns: TABLE_COLUMNS, rows })])
      );
    } else {
      body.push(dataTable({ columns: TABLE_COLUMNS, rows }));
    }
    return body;
  });

  const footerContext = `Mikro SRL — Reporte de clientes · Generado ${formatDateEs(data.generatedAt)}`;
  return composeReportPages(pageBodies, () => [footerContext]);
}

/** The customers report: validated `CustomerForGrouping[]` in, JSON/PDF out. */
export const customersReport: Report<CustomersReportData> = defineReport({
  name: "customers",
  inputSchema: customersReportInputSchema,
  buildData: buildCustomersReportData,
  toDocument: buildCustomersReportDocument
});
