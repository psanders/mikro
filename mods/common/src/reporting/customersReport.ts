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
import { formatPaymentFrequency } from "../utils/customerReportHelpers.js";
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
  return [
    { label: "Clientes activos", value: `${data.activeCustomers}` },
    { label: "Crítico", value: `${data.criticoCount}`, emphasize: true },
    { label: "Requiere atención", value: `${data.requiereAtencionCount}` },
    { label: "Al día", value: `${data.alDiaCount}` }
  ];
}

function buildRows(data: CustomersReportData): TableRow[] {
  return data.rows.map((r) => ({
    cells: {
      nombre: r.name,
      telefono: r.phone,
      prestamo: `${r.loanId}`,
      ciclo: formatPaymentFrequency(r.paymentFrequency),
      pagos: `${Math.min(r.paymentsMade, r.termLength)}/${r.termLength}`,
      estado: ""
    },
    status: { column: "estado", value: HEALTH_LABELS[r.health], tone: HEALTH_TONES[r.health] }
  }));
}

/** Compose the 1-page customers-report document from the canonical data model. */
export function buildCustomersReportDocument(data: CustomersReportData): ReportDocument {
  const meta = [
    `Generado ${formatDateEs(data.generatedAt)}`,
    `${data.activeCustomers} clientes · ${data.totalLoans} préstamos`
  ];

  const p1 = page([
    brandHeader({
      title: "Reporte de Clientes",
      subtitle: "Salud de pagos por préstamo",
      meta
    }),
    kpiGrid({ cells: buildKpiCells(data), columns: 4 }),
    section("Clientes", [
      dataTable({
        columns: [
          { key: "nombre", header: "Nombre", weight: 1.7 },
          { key: "telefono", header: "Teléfono", weight: 1.1 },
          { key: "prestamo", header: "Préstamo", weight: 0.7, align: "right" },
          { key: "ciclo", header: "Ciclo", weight: 0.9 },
          { key: "pagos", header: "Pagos", weight: 0.8, align: "right" },
          { key: "estado", header: "Estado", weight: 1.1 }
        ],
        rows: buildRows(data)
      })
    ]),
    footerNote([
      `Reporte de clientes · Generado ${formatDateEs(data.generatedAt)} · Documento generado automáticamente por Mikro.`
    ])
  ]);

  return { pages: [{ layout: p1 }] };
}

/** The customers report: validated `CustomerForGrouping[]` in, JSON/PDF out. */
export const customersReport: Report<CustomersReportData> = defineReport({
  name: "customers",
  inputSchema: customersReportInputSchema,
  buildData: buildCustomersReportData,
  toDocument: buildCustomersReportDocument
});
