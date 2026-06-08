/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared utilities for customer export commands.
 */
import { writeFile } from "node:fs/promises";
import cliui from "cliui";
import ExcelJS from "exceljs";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "./cliTableLayout.js";
import {
  getPaymentRating,
  getMissedPaymentsCount,
  getLatenessTrend,
  getReportRowHighlight,
  formatPaymentFrequency,
  getCycleMetrics,
  buildGroupedCustomerRows,
  renderCustomersReportToPng,
  loadLogoDataUrl,
  getLogoPath,
  type GroupedCustomerRow
} from "@mikro/common";

/**
 * Loan data as returned from tRPC (dates serialized as strings).
 */
interface SerializedLoan {
  loanId: number;
  paymentFrequency: string;
  createdAt: string | Date;
  startingDate?: string | Date | null;
  termLength: number;
  payments: Array<{ paidAt: string | Date; status?: string }>;
  nickname?: string | null;
}

/**
 * Customer data as returned from tRPC export endpoints.
 * Uses optional types since tRPC may serialize nulls as undefined.
 */
export interface SerializedCustomer {
  name: string;
  nickname?: string | null;
  phone: string;
  collectionPoint?: string | null;
  notes?: string | null;
  preferredPaymentDay?: string | null;
  loans: SerializedLoan[];
}

function formatPagosCell(paymentsMade: number, termLength: number): string {
  const t = Math.max(0, termLength);
  if (t === 0) return "0/0";
  return `${Math.min(paymentsMade, t)}/${t}`;
}

function toLoanData(loan: SerializedLoan, preferredPaymentDay?: string | null) {
  return {
    paymentFrequency: loan.paymentFrequency,
    createdAt: new Date(loan.createdAt),
    startingDate:
      loan.startingDate != null && loan.startingDate !== "" ? new Date(loan.startingDate) : null,
    payments: loan.payments.map((p) => ({
      paidAt: new Date(p.paidAt),
      ...(p.status !== undefined ? { status: p.status } : {})
    })),
    preferredPaymentDay,
    termLength: loan.termLength
  };
}

const STAR = "★";

function ratingToStars(rating: 1 | 2 | 3 | 4 | 5): string {
  return STAR.repeat(rating);
}

export interface CustomerReportRow {
  name: string;
  phone: string;
  loanId: number;
  nickname: string;
  paymentCycle: string;
  rating: string;
  missedCount: number;
  paymentsMade: number;
  termLength: number;
  trend: string;
  collectionPoint: string;
  notes: string;
}

/**
 * Build sorted report rows (rating ascending, then missed count descending).
 */
export function buildCustomerReportRows(customers: SerializedCustomer[]): CustomerReportRow[] {
  const rows: CustomerReportRow[] = [];
  for (const customer of customers) {
    const customerNick = customer.nickname?.trim();
    for (const loan of customer.loans) {
      const data = toLoanData(loan, customer.preferredPaymentDay);
      const { paymentsMade } = getCycleMetrics(data);
      const loanNick = loan.nickname?.trim();
      const displayNick = customerNick && customerNick.length > 0 ? customerNick : (loanNick ?? "");
      rows.push({
        name: customer.name,
        phone: customer.phone,
        loanId: loan.loanId,
        nickname: displayNick,
        paymentCycle: formatPaymentFrequency(loan.paymentFrequency),
        rating: ratingToStars(getPaymentRating(data)),
        missedCount: getMissedPaymentsCount(data),
        paymentsMade,
        termLength: loan.termLength,
        trend: getLatenessTrend(data),
        collectionPoint: customer.collectionPoint ?? "",
        notes: customer.notes ?? ""
      });
    }
  }
  rows.sort((a, b) => {
    const ra = a.rating.length;
    const rb = b.rating.length;
    if (ra !== rb) return ra - rb;
    return b.missedCount - a.missedCount;
  });
  return rows;
}

/**
 * Output customers as CSV format to a log function.
 * Rows are sorted by rating (1 star first), then missed count descending.
 */
export function outputCustomersAsCsv(
  customers: SerializedCustomer[],
  log: (message: string) => void
): void {
  log("Nombre,Apodo,Teléfono,Préstamo,Ciclo de Pago,Rating,Pagos,Tendencia,Lugar de Cobro,Notas");
  const rows = buildCustomerReportRows(customers);
  for (const r of rows) {
    const row = [
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.nickname.replace(/"/g, '""')}"`,
      r.phone,
      r.loanId,
      r.paymentCycle,
      r.rating,
      formatPagosCell(r.paymentsMade, r.termLength),
      r.trend,
      `"${r.collectionPoint.replace(/"/g, '""')}"`,
      `"${(r.notes ?? "").replace(/"/g, '""')}"`
    ].join(",");
    log(row);
  }
}

/**
 * Output customers as a formatted table to a log function.
 * Rows are sorted by rating (1 star first), then missed count descending.
 */
export function outputCustomersAsTable(
  customers: SerializedCustomer[],
  log: (message: string) => void
): void {
  const headers = [
    "NOMBRE",
    "APODO",
    "TELÉFONO",
    "PRÉSTAMO",
    "CICLO",
    "RATING",
    "PAGOS",
    "TENDENCIA",
    "NOTAS"
  ];
  const reportRows = buildCustomerReportRows(customers);
  const dataRows = reportRows.map((r) => [
    r.name,
    r.nickname ?? "",
    r.phone,
    String(r.loanId),
    r.paymentCycle,
    r.rating,
    formatPagosCell(r.paymentsMade, r.termLength),
    r.trend,
    r.notes ?? ""
  ]);
  const widths = computeColumnWidths({
    headers,
    rows: dataRows,
    maxWidths: [
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      56
    ]
  });
  const ui = cliui({ width: cliuiTableWidth(widths) });
  ui.div(...cliuiCells(headers, widths));
  for (const row of dataRows) {
    ui.div(...cliuiCells(row, widths));
  }

  log(ui.toString());
  log(`\nTotal: ${reportRows.length} préstamos de ${customers.length} clientes`);
}

/** Convert serialized customers to the shape expected by buildGroupedCustomerRows. */
function toCustomersForGrouping(
  customers: SerializedCustomer[]
): Parameters<typeof buildGroupedCustomerRows>[0] {
  return customers.map((m) => ({
    name: m.name,
    nickname: m.nickname,
    phone: m.phone,
    preferredPaymentDay: m.preferredPaymentDay,
    loans: m.loans.map((loan) => ({
      loanId: loan.loanId,
      paymentFrequency: loan.paymentFrequency,
      createdAt: new Date(loan.createdAt),
      startingDate:
        loan.startingDate != null && loan.startingDate !== "" ? new Date(loan.startingDate) : null,
      termLength: loan.termLength,
      payments: loan.payments.map((p) => ({
        paidAt: new Date(p.paidAt),
        ...(p.status !== undefined ? { status: p.status } : {})
      })),
      nickname: loan.nickname
    }))
  }));
}

/**
 * Output customers grouped by payment health (Crítico / Requiere atención / Al día) as a table.
 */
export function outputCustomersGroupedAsTable(
  customers: SerializedCustomer[],
  log: (message: string) => void
): void {
  const forGrouping = toCustomersForGrouping(customers);
  const grouped = buildGroupedCustomerRows(forGrouping);

  const totalRows = grouped.critico.length + grouped.requiereAtencion.length + grouped.alDia.length;
  log(`Total: ${totalRows} préstamos de ${customers.length} clientes\n`);

  const cellsFor = (r: GroupedCustomerRow) => [
    r.name,
    r.nickname ?? "",
    r.phone,
    String(r.loanId),
    formatPaymentFrequency(r.paymentFrequency),
    ratingToStars(r.rating),
    formatPagosCell(r.paymentsMade, r.termLength)
  ];
  outputGroupedSection(log, "Crítico (requieren seguimiento)", grouped.critico, cellsFor);
  outputGroupedSection(log, "Requiere atención", grouped.requiereAtencion, cellsFor);
  outputGroupedSection(log, "Al día", grouped.alDia, cellsFor);
}

function outputGroupedSection(
  log: (message: string) => void,
  title: string,
  rows: GroupedCustomerRow[],
  rowToCells: (r: GroupedCustomerRow) => string[]
): void {
  if (rows.length === 0) return;
  log(`--- ${title} (${rows.length}) ---`);
  const headers = ["NOMBRE", "APODO", "TELÉFONO", "PRÉSTAMO", "CICLO", "RATINGS", "PAGOS"];
  const dataRows = rows.map((r) => rowToCells(r));
  const widths = computeColumnWidths({ headers, rows: dataRows });
  const ui = cliui({ width: cliuiTableWidth(widths) });
  ui.div(...cliuiCells(headers, widths));
  for (const cells of dataRows) {
    ui.div(...cliuiCells(cells, widths));
  }
  log(ui.toString());
  log("");
}

/**
 * Output customers grouped by payment health as CSV with a Group column.
 */
export function outputCustomersGroupedAsCsv(
  customers: SerializedCustomer[],
  log: (message: string) => void
): void {
  const forGrouping = toCustomersForGrouping(customers);
  const grouped = buildGroupedCustomerRows(forGrouping);

  log("Grupo,Nombre,Apodo,Telefono,Prestamo,Ciclo de Pago,Rating,Pagos");

  const emit = (group: string, rows: GroupedCustomerRow[]) => {
    for (const r of rows) {
      const name = r.name.replace(/"/g, '""');
      const nick = r.nickname.replace(/"/g, '""');
      const row = [
        `"${group}"`,
        `"${name}"`,
        `"${nick}"`,
        r.phone,
        r.loanId,
        formatPaymentFrequency(r.paymentFrequency),
        ratingToStars(r.rating),
        formatPagosCell(r.paymentsMade, r.termLength)
      ].join(",");
      log(row);
    }
  };

  emit("Crítico", grouped.critico);
  emit("Requiere atención", grouped.requiereAtencion);
  emit("Al día", grouped.alDia);
}

// ---------------------------------------------------------------------------
// File output helpers (--output flag)
// ---------------------------------------------------------------------------

function highlightToArgb(highlight: "yellow" | "red" | null): { argb: string } | null {
  if (highlight === "yellow") return { argb: "FFFFF4E6" };
  if (highlight === "red") return { argb: "FFFFEBEE" };
  return null;
}

/**
 * Write customers report to an Excel file at `filepath`.
 * Full 10-column report with highlights, same format as WhatsApp Excel.
 */
export async function writeCustomersToExcel(
  customers: SerializedCustomer[],
  filepath: string
): Promise<{ loanCount: number; customerCount: number }> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Reporte de Clientes");

  worksheet.columns = [
    { header: "Nombre", key: "name", width: 25 },
    { header: "Apodo", key: "nickname", width: 25 },
    { header: "Teléfono", key: "phone", width: 15 },
    { header: "Préstamo", key: "loanId", width: 12 },
    { header: "Ciclo de Pago", key: "paymentCycle", width: 14 },
    { header: "Rating", key: "rating", width: 8 },
    { header: "Pagos", key: "pagos", width: 12 },
    { header: "Tendencia", key: "trend", width: 12 },
    { header: "Lugar de Cobro", key: "collectionPoint", width: 36 },
    { header: "Notas", key: "notes", width: 25 }
  ];

  worksheet.columns.forEach((column) => {
    column.alignment = { horizontal: "left", vertical: "top" };
  });
  const notasColumn = worksheet.getColumn("notes");
  if (notasColumn) {
    notasColumn.alignment = { horizontal: "left", vertical: "top", wrapText: true };
  }

  const borderStyle = { style: "thin" as const, color: { argb: "FFD3D3D3" } };

  type ExcelRowData = CustomerReportRow & { highlight: "yellow" | "red" | null };

  const rows: ExcelRowData[] = [];
  for (const customer of customers) {
    const customerNick = customer.nickname?.trim();
    for (const loan of customer.loans) {
      const data = toLoanData(loan, customer.preferredPaymentDay);
      const { paymentsMade } = getCycleMetrics(data);
      const loanNick = loan.nickname?.trim();
      const displayNick = customerNick && customerNick.length > 0 ? customerNick : (loanNick ?? "");
      rows.push({
        name: customer.name,
        phone: customer.phone,
        loanId: loan.loanId,
        nickname: displayNick,
        paymentCycle: formatPaymentFrequency(loan.paymentFrequency),
        rating: ratingToStars(getPaymentRating(data)),
        missedCount: getMissedPaymentsCount(data),
        paymentsMade,
        termLength: loan.termLength,
        trend: getLatenessTrend(data),
        collectionPoint: customer.collectionPoint ?? "",
        notes: customer.notes ?? "",
        highlight: getReportRowHighlight(data)
      });
    }
  }
  rows.sort((a, b) => {
    const ra = a.rating.length;
    const rb = b.rating.length;
    if (ra !== rb) return ra - rb;
    return b.missedCount - a.missedCount;
  });

  for (const r of rows) {
    const row = worksheet.addRow({
      name: r.name,
      nickname: r.nickname,
      phone: r.phone,
      loanId: r.loanId,
      paymentCycle: r.paymentCycle,
      rating: r.rating,
      pagos: formatPagosCell(r.paymentsMade, r.termLength),
      trend: r.trend,
      collectionPoint: r.collectionPoint,
      notes: r.notes
    });

    const fillColor = highlightToArgb(r.highlight);
    row.eachCell((cell, colNumber) => {
      const columnKey = worksheet.getColumn(colNumber).key;
      const shouldWrap = columnKey === "notes";
      cell.alignment = { horizontal: "left", vertical: "top", wrapText: shouldWrap };
      cell.border = {
        top: borderStyle,
        left: borderStyle,
        bottom: borderStyle,
        right: borderStyle
      };
      if (fillColor) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: fillColor };
      }
    });
  }

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "left", vertical: "top" };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" }
  };
  headerRow.eachCell((cell) => {
    cell.border = {
      top: borderStyle,
      left: borderStyle,
      bottom: borderStyle,
      right: borderStyle
    };
  });

  await workbook.xlsx.writeFile(filepath);
  return { loanCount: rows.length, customerCount: customers.length };
}

/**
 * Write customers report to a PNG file at `filepath`.
 * Simplified grouped layout (same as WhatsApp image).
 */
export async function writeCustomersToPng(
  customers: SerializedCustomer[],
  filepath: string
): Promise<{ loanCount: number; customerCount: number }> {
  const forGrouping = toCustomersForGrouping(customers);
  const logoDataUrl = loadLogoDataUrl(getLogoPath());
  const pngBuffer = await renderCustomersReportToPng(
    forGrouping,
    undefined,
    logoDataUrl ?? undefined
  );
  await writeFile(filepath, pngBuffer);
  const loanCount = customers.reduce((sum, m) => sum + m.loans.length, 0);
  return { loanCount, customerCount: customers.length };
}

/**
 * Write extended customers report to a CSV file at `filepath`.
 * Same content as outputCustomersAsCsv.
 */
export async function writeCustomersToCsv(
  customers: SerializedCustomer[],
  filepath: string
): Promise<{ loanCount: number; customerCount: number }> {
  const lines: string[] = [];
  lines.push(
    "Nombre,Apodo,Teléfono,Préstamo,Ciclo de Pago,Rating,Pagos,Tendencia,Lugar de Cobro,Notas"
  );
  const rows = buildCustomerReportRows(customers);
  for (const r of rows) {
    lines.push(
      [
        `"${r.name.replace(/"/g, '""')}"`,
        `"${r.nickname.replace(/"/g, '""')}"`,
        r.phone,
        r.loanId,
        r.paymentCycle,
        r.rating,
        formatPagosCell(r.paymentsMade, r.termLength),
        r.trend,
        `"${r.collectionPoint.replace(/"/g, '""')}"`,
        `"${(r.notes ?? "").replace(/"/g, '""')}"`
      ].join(",")
    );
  }
  await writeFile(filepath, lines.join("\n"));
  return { loanCount: rows.length, customerCount: customers.length };
}

/**
 * Handle --output flag for customer export commands. Writes to file when output is set;
 * returns true. When output is not set, returns false so the command can print extended table to stdout.
 */
export async function handleCustomersOutput(
  customers: SerializedCustomer[],
  output: string | undefined,
  log: (msg: string) => void,
  error: (msg: string) => never
): Promise<boolean> {
  if (!output) return false;
  const ext = output.split(".").pop()?.toLowerCase();
  if (ext === "xlsx") {
    const { loanCount, customerCount } = await writeCustomersToExcel(customers, output);
    log(`Excel guardado: ${output} (${loanCount} préstamos, ${customerCount} clientes)`);
    return true;
  }
  if (ext === "png") {
    const { loanCount, customerCount } = await writeCustomersToPng(customers, output);
    log(`PNG guardado: ${output} (${loanCount} préstamos, ${customerCount} clientes)`);
    return true;
  }
  if (ext === "csv") {
    const { loanCount, customerCount } = await writeCustomersToCsv(customers, output);
    log(`CSV guardado: ${output} (${loanCount} préstamos, ${customerCount} clientes)`);
    return true;
  }
  error("--output must end in .xlsx, .png, or .csv");
}

// ---------------------------------------------------------------------------
