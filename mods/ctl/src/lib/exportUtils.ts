/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared utilities for member export commands.
 */
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cliui from "cliui";
import ExcelJS from "exceljs";
import {
  getPaymentRating,
  getMissedPaymentsCount,
  getLatenessTrend,
  getReportRowHighlight,
  formatPaymentFrequency,
  buildGroupedMemberRows,
  renderMembersReportToPng,
  loadLogoDataUrl,
  type GroupedMemberRow
} from "@mikro/common";

const __ctlDir = dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = join(__ctlDir, "../../../apiserver/assets/logo.png");

/**
 * Loan data as returned from tRPC (dates serialized as strings).
 */
interface SerializedLoan {
  loanId: number;
  paymentFrequency: string;
  createdAt: string | Date;
  payments: Array<{ paidAt: string | Date }>;
}

/**
 * Member data as returned from tRPC export endpoints.
 * Uses optional types since tRPC may serialize nulls as undefined.
 */
export interface SerializedMember {
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

export interface MemberReportRow {
  name: string;
  phone: string;
  loanId: number;
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
export function buildMemberReportRows(members: SerializedMember[]): MemberReportRow[] {
  const rows: MemberReportRow[] = [];
  for (const member of members) {
    for (const loan of member.loans) {
      const data = toLoanData(loan, member.preferredPaymentDay);
      rows.push({
        name: member.name,
        phone: member.phone,
        loanId: loan.loanId,
        paymentCycle: formatPaymentFrequency(loan.paymentFrequency),
        rating: ratingToStars(getPaymentRating(data)),
        missedCount: getMissedPaymentsCount(data),
        trend: getLatenessTrend(data),
        referredBy: member.referredBy.name,
        collectionPoint: member.collectionPoint ?? "",
        notes: member.notes ?? ""
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
 * Output members as CSV format to a log function.
 * Rows are sorted by rating (1 star first), then missed count descending.
 */
export function outputMembersAsCsv(
  members: SerializedMember[],
  log: (message: string) => void
): void {
  log(
    "Nombre,Teléfono,Préstamo,Ciclo de Pago,Rating,Pagos atrasados,Tendencia,Afiliado por,Lugar de Cobro,Notas"
  );
  const rows = buildMemberReportRows(members);
  for (const r of rows) {
    const row = [
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
    ].join(",");
    log(row);
  }
}

/**
 * Output members as a formatted table to a log function.
 * Rows are sorted by rating (1 star first), then missed count descending.
 */
export function outputMembersAsTable(
  members: SerializedMember[],
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

  const rows = buildMemberReportRows(members);
  for (const r of rows) {
    ui.div(
      { text: r.name, padding: [0, 0, 0, 0], width: 25 },
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
  log(`\nTotal: ${rows.length} préstamos de ${members.length} clientes`);
}

/** Convert serialized members to the shape expected by buildGroupedMemberRows. */
function toMembersForGrouping(
  members: SerializedMember[]
): Parameters<typeof buildGroupedMemberRows>[0] {
  return members.map((m) => ({
    name: m.name,
    phone: m.phone,
    preferredPaymentDay: m.preferredPaymentDay,
    loans: m.loans.map((loan) => ({
      loanId: loan.loanId,
      paymentFrequency: loan.paymentFrequency,
      createdAt: new Date(loan.createdAt),
      payments: loan.payments.map((p) => ({ paidAt: new Date(p.paidAt) }))
    }))
  }));
}

/**
 * Output members grouped by payment health (Crítico / Requiere atención / Al día) as a table.
 */
export function outputMembersGroupedAsTable(
  members: SerializedMember[],
  log: (message: string) => void
): void {
  const forGrouping = toMembersForGrouping(members);
  const grouped = buildGroupedMemberRows(forGrouping);

  const totalRows = grouped.critico.length + grouped.requiereAtencion.length + grouped.alDia.length;
  log(`Total: ${totalRows} préstamos de ${members.length} clientes\n`);

  outputGroupedSection(log, "Crítico (requieren seguimiento)", grouped.critico, (r) => [
    r.name,
    r.phone,
    String(r.loanId),
    formatPaymentFrequency(r.paymentFrequency),
    ratingToStars(r.rating),
    String(r.missedCount)
  ]);
  outputGroupedSection(log, "Requiere atención", grouped.requiereAtencion, (r) => [
    r.name,
    r.phone,
    String(r.loanId),
    formatPaymentFrequency(r.paymentFrequency),
    ratingToStars(r.rating),
    String(r.missedCount)
  ]);
  outputGroupedSection(log, "Al día", grouped.alDia, (r) => [
    r.name,
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
  rows: GroupedMemberRow[],
  rowToCells: (r: GroupedMemberRow) => string[]
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
 * Output members grouped by payment health as CSV with a Group column.
 */
export function outputMembersGroupedAsCsv(
  members: SerializedMember[],
  log: (message: string) => void
): void {
  const forGrouping = toMembersForGrouping(members);
  const grouped = buildGroupedMemberRows(forGrouping);

  log("Grupo,Nombre,Telefono,Prestamo,Ciclo de Pago,Rating,Pagos atrasados");

  const emit = (group: string, rows: GroupedMemberRow[]) => {
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
 * Write members report to an Excel file at `filepath`.
 * Full 10-column report with highlights, same format as WhatsApp Excel.
 */
export async function writeMembersToExcel(
  members: SerializedMember[],
  filepath: string
): Promise<{ loanCount: number; memberCount: number }> {
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

  type ExcelRowData = MemberReportRow & { highlight: "yellow" | "red" | null };

  const rows: ExcelRowData[] = [];
  for (const member of members) {
    for (const loan of member.loans) {
      const data = toLoanData(loan, member.preferredPaymentDay);
      rows.push({
        name: member.name,
        phone: member.phone,
        loanId: loan.loanId,
        paymentCycle: formatPaymentFrequency(loan.paymentFrequency),
        rating: ratingToStars(getPaymentRating(data)),
        missedCount: getMissedPaymentsCount(data),
        trend: getLatenessTrend(data),
        referredBy: member.referredBy.name,
        collectionPoint: member.collectionPoint ?? "",
        notes: member.notes ?? "",
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
  return { loanCount: rows.length, memberCount: members.length };
}

/**
 * Write members report to a PNG file at `filepath`.
 * Simplified grouped layout (same as WhatsApp image).
 */
export async function writeMembersToPng(
  members: SerializedMember[],
  filepath: string
): Promise<{ loanCount: number; memberCount: number }> {
  const forGrouping = toMembersForGrouping(members);
  const logoDataUrl = loadLogoDataUrl(LOGO_PATH);
  const pngBuffer = await renderMembersReportToPng(
    forGrouping,
    undefined,
    logoDataUrl ?? undefined
  );
  await writeFile(filepath, pngBuffer);
  const loanCount = members.reduce((sum, m) => sum + m.loans.length, 0);
  return { loanCount, memberCount: members.length };
}

/**
 * Write extended members report to a CSV file at `filepath`.
 * Same content as outputMembersAsCsv.
 */
export async function writeMembersToCsv(
  members: SerializedMember[],
  filepath: string
): Promise<{ loanCount: number; memberCount: number }> {
  const lines: string[] = [];
  lines.push(
    "Nombre,Teléfono,Préstamo,Ciclo de Pago,Rating,Pagos atrasados,Tendencia,Afiliado por,Lugar de Cobro,Notas"
  );
  const rows = buildMemberReportRows(members);
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
  return { loanCount: rows.length, memberCount: members.length };
}

/**
 * Handle --output flag for member export commands. Writes to file when output is set;
 * returns true. When output is not set, returns false so the command can print extended table to stdout.
 */
export async function handleMembersOutput(
  members: SerializedMember[],
  output: string | undefined,
  log: (msg: string) => void,
  error: (msg: string) => never
): Promise<boolean> {
  if (!output) return false;
  const ext = output.split(".").pop()?.toLowerCase();
  if (ext === "xlsx") {
    const { loanCount, memberCount } = await writeMembersToExcel(members, output);
    log(`Excel guardado: ${output} (${loanCount} préstamos, ${memberCount} clientes)`);
    return true;
  }
  if (ext === "png") {
    const { loanCount, memberCount } = await writeMembersToPng(members, output);
    log(`PNG guardado: ${output} (${loanCount} préstamos, ${memberCount} clientes)`);
    return true;
  }
  if (ext === "csv") {
    const { loanCount, memberCount } = await writeMembersToCsv(members, output);
    log(`CSV guardado: ${output} (${loanCount} préstamos, ${memberCount} clientes)`);
    return true;
  }
  error("--output must end in .xlsx, .png, or .csv");
}
