/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared utilities for customer export commands.
 */
import { writeFile } from "node:fs/promises";
import cliui from "cliui";
import ExcelJS from "exceljs";
import {
  getPaymentRating,
  getMissedPaymentsCount,
  getLatenessTrend,
  getReportRowHighlight,
  formatPaymentFrequency,
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
  payments: Array<{ paidAt: string | Date }>;
  nickname?: string | null;
}

/**
 * Customer data as returned from tRPC export endpoints.
 * Uses optional types since tRPC may serialize nulls as undefined.
 */
export interface SerializedCustomer {
  name: string;
  phone: string;
  collectionPoint?: string | null;
  notes?: string | null;
  preferredPaymentDay?: string | null;
  referredBy: { name: string };
  loans: SerializedLoan[];
}

function toLoanData(loan: SerializedLoan, preferredPaymentDay?: string | null) {
  return {
    paymentFrequency: loan.paymentFrequency,
    createdAt: new Date(loan.createdAt),
    payments: loan.payments.map((p) => ({ paidAt: new Date(p.paidAt) })),
    preferredPaymentDay
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
  trend: string;
  referredBy: string;
  collectionPoint: string;
  notes: string;
}

/**
 * Build sorted report rows (rating ascending, then missed count descending).
 */
export function buildCustomerReportRows(customers: SerializedCustomer[]): CustomerReportRow[] {
  const rows: CustomerReportRow[] = [];
  for (const customer of customers) {
    for (const loan of customer.loans) {
      const data = toLoanData(loan, customer.preferredPaymentDay);
      rows.push({
        name: customer.name,
        phone: customer.phone,
        loanId: loan.loanId,
        nickname: loan.nickname ?? "",
        paymentCycle: formatPaymentFrequency(loan.paymentFrequency),
        rating: ratingToStars(getPaymentRating(data)),
        missedCount: getMissedPaymentsCount(data),
        trend: getLatenessTrend(data),
        referredBy: customer.referredBy.name,
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
  log(
    "Nombre,Teléfono,Préstamo,Ciclo de Pago,Rating,Pagos atrasados,Tendencia,Afiliado por,Lugar de Cobro,Notas"
  );
  const rows = buildCustomerReportRows(customers);
  for (const r of rows) {
    const displayName = r.nickname || r.name;
    const row = [
      `"${displayName}"`,
      r.phone,
      r.loanId,
      r.paymentCycle,
      r.rating,
      r.missedCount,
      r.trend,
      `"${r.referredBy}"`,
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
  const ui = cliui({ width: 232 });

  ui.div(
    { text: "NOMBRE", padding: [0, 0, 0, 0], width: 25 },
    { text: "TELÉFONO", padding: [0, 0, 0, 0], width: 15 },
    { text: "PRÉSTAMO", padding: [0, 0, 0, 0], width: 10 },
    { text: "CICLO", padding: [0, 0, 0, 0], width: 10 },
    { text: "RATING", padding: [0, 0, 0, 0], width: 8 },
    { text: "ATRASADOS", padding: [0, 0, 0, 0], width: 10 },
    { text: "TENDENCIA", padding: [0, 0, 0, 0], width: 12 },
    { text: "REFERIDOR", padding: [0, 0, 0, 0], width: 20 },
    { text: "LUGAR DE COBRO", padding: [0, 0, 0, 0], width: 40 },
    { text: "NOTAS", padding: [0, 0, 0, 0], width: 30 }
  );

  const rows = buildCustomerReportRows(customers);
  for (const r of rows) {
    const displayName = r.nickname || r.name;
    ui.div(
      { text: displayName, padding: [0, 0, 0, 0], width: 25 },
      { text: r.phone, padding: [0, 0, 0, 0], width: 15 },
      { text: String(r.loanId), padding: [0, 0, 0, 0], width: 10 },
      { text: r.paymentCycle, padding: [0, 0, 0, 0], width: 10 },
      { text: r.rating, padding: [0, 0, 0, 0], width: 8 },
      { text: String(r.missedCount), padding: [0, 0, 0, 0], width: 10 },
      { text: r.trend, padding: [0, 0, 0, 0], width: 12 },
      { text: r.referredBy, padding: [0, 0, 0, 0], width: 20 },
      { text: r.collectionPoint, padding: [0, 0, 0, 0], width: 40 },
      { text: r.notes ?? "", padding: [0, 0, 0, 0], width: 30 }
    );
  }

  log(ui.toString());
  log(`\nTotal: ${rows.length} préstamos de ${customers.length} clientes`);
}

/** Convert serialized customers to the shape expected by buildGroupedCustomerRows. */
function toCustomersForGrouping(
  customers: SerializedCustomer[]
): Parameters<typeof buildGroupedCustomerRows>[0] {
  return customers.map((m) => ({
    name: m.name,
    phone: m.phone,
    preferredPaymentDay: m.preferredPaymentDay,
    loans: m.loans.map((loan) => ({
      loanId: loan.loanId,
      paymentFrequency: loan.paymentFrequency,
      createdAt: new Date(loan.createdAt),
      payments: loan.payments.map((p) => ({ paidAt: new Date(p.paidAt) })),
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

  const displayName = (r: GroupedCustomerRow) => r.nickname || r.name;
  outputGroupedSection(log, "Crítico (requieren seguimiento)", grouped.critico, (r) => [
    displayName(r),
    r.phone,
    String(r.loanId),
    formatPaymentFrequency(r.paymentFrequency),
    ratingToStars(r.rating),
    String(r.missedCount)
  ]);
  outputGroupedSection(log, "Requiere atención", grouped.requiereAtencion, (r) => [
    displayName(r),
    r.phone,
    String(r.loanId),
    formatPaymentFrequency(r.paymentFrequency),
    ratingToStars(r.rating),
    String(r.missedCount)
  ]);
  outputGroupedSection(log, "Al día", grouped.alDia, (r) => [
    displayName(r),
    r.phone,
    String(r.loanId),
    formatPaymentFrequency(r.paymentFrequency),
    ratingToStars(r.rating),
    String(r.missedCount)
  ]);
}

function outputGroupedSection(
  log: (message: string) => void,
  title: string,
  rows: GroupedCustomerRow[],
  rowToCells: (r: GroupedCustomerRow) => string[]
): void {
  if (rows.length === 0) return;
  log(`--- ${title} (${rows.length}) ---`);
  const ui = cliui({ width: 132 });
  ui.div(
    { text: "NOMBRE", padding: [0, 0, 0, 0], width: 28 },
    { text: "TELEFONO", padding: [0, 0, 0, 0], width: 14 },
    { text: "PRESTAMO", padding: [0, 0, 0, 0], width: 10 },
    { text: "CICLO", padding: [0, 0, 0, 0], width: 10 },
    { text: "RATING", padding: [0, 0, 0, 0], width: 8 },
    { text: "ATRASOS", padding: [0, 0, 0, 0], width: 10 }
  );
  for (const r of rows) {
    const cells = rowToCells(r);
    ui.div(
      { text: cells[0], padding: [0, 0, 0, 0], width: 28 },
      { text: cells[1], padding: [0, 0, 0, 0], width: 14 },
      { text: cells[2], padding: [0, 0, 0, 0], width: 10 },
      { text: cells[3], padding: [0, 0, 0, 0], width: 10 },
      { text: cells[4], padding: [0, 0, 0, 0], width: 8 },
      { text: cells[5], padding: [0, 0, 0, 0], width: 10 }
    );
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

  log("Grupo,Nombre,Telefono,Prestamo,Ciclo de Pago,Rating,Pagos atrasados");

  const emit = (group: string, rows: GroupedCustomerRow[]) => {
    for (const r of rows) {
      const row = [
        `"${group}"`,
        `"${r.name.replace(/"/g, '""')}"`,
        r.phone,
        r.loanId,
        formatPaymentFrequency(r.paymentFrequency),
        ratingToStars(r.rating),
        r.missedCount
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
    { header: "Teléfono", key: "phone", width: 15 },
    { header: "Préstamo", key: "loanId", width: 12 },
    { header: "Ciclo de Pago", key: "paymentCycle", width: 14 },
    { header: "Rating", key: "rating", width: 8 },
    { header: "Pagos atrasados", key: "missedCount", width: 16 },
    { header: "Tendencia", key: "trend", width: 12 },
    { header: "Afiliado por", key: "referredBy", width: 20 },
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
    for (const loan of customer.loans) {
      const data = toLoanData(loan, customer.preferredPaymentDay);
      rows.push({
        name: customer.name,
        phone: customer.phone,
        loanId: loan.loanId,
        nickname: loan.nickname ?? "",
        paymentCycle: formatPaymentFrequency(loan.paymentFrequency),
        rating: ratingToStars(getPaymentRating(data)),
        missedCount: getMissedPaymentsCount(data),
        trend: getLatenessTrend(data),
        referredBy: customer.referredBy.name,
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
    const displayName = r.nickname || r.name;
    const row = worksheet.addRow({
      name: displayName,
      phone: r.phone,
      loanId: r.loanId,
      paymentCycle: r.paymentCycle,
      rating: r.rating,
      missedCount: r.missedCount,
      trend: r.trend,
      referredBy: r.referredBy,
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
    "Nombre,Teléfono,Préstamo,Ciclo de Pago,Rating,Pagos atrasados,Tendencia,Afiliado por,Lugar de Cobro,Notas"
  );
  const rows = buildCustomerReportRows(customers);
  for (const r of rows) {
    lines.push(
      [
        `"${r.name}"`,
        r.phone,
        r.loanId,
        r.paymentCycle,
        r.rating,
        r.missedCount,
        r.trend,
        `"${r.referredBy}"`,
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
