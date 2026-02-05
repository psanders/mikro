/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared utilities for generating Excel member reports.
 */
import ExcelJS from "exceljs";
import {
  getPaymentRating,
  getMissedPaymentsCount,
  getLatenessTrend,
  getReportRowHighlight
} from "@mikro/common";
import type { ExportedMember, ExportedLoan } from "./types.js";

export type { ExportedMember, ExportedLoan };

// Deprecated aliases - use ExportedMember and ExportedLoan instead
/** @deprecated Use ExportedLoan instead */
export type LoanWithPayments = ExportedLoan;
/** @deprecated Use ExportedMember instead */
export type MemberExportData = ExportedMember;

/**
 * Result of generating an Excel report.
 */
export interface ExcelGenerationResult {
  buffer: Buffer;
  filename: string;
  memberCount: number;
  loanCount: number;
}

/**
 * Generate a filename for the Excel report with optional prefix.
 */
export function generateFilename(prefix = "reporte-miembros"): string {
  const now = new Date();
  const date = now.toISOString().split("T")[0]; // YYYY-MM-DD
  return `${prefix}-${date}.xlsx`;
}

const STAR = "★";

function ratingToStars(rating: 1 | 2 | 3 | 4 | 5): string {
  return STAR.repeat(rating);
}

function highlightToArgb(highlight: "yellow" | "red" | null): { argb: string } | null {
  if (highlight === "yellow") return { argb: "FFFFF4E6" };
  if (highlight === "red") return { argb: "FFFFEBEE" };
  return null;
}

/**
 * Generate an Excel report from member data.
 * Rows are sorted by rating (1 star = worst first), then by missed count descending.
 *
 * @param members - Array of member data with loans
 * @param filenamePrefix - Optional prefix for the filename (default: "reporte-miembros")
 * @returns Excel buffer, filename, and counts
 */
export async function generateMembersExcel(
  members: ExportedMember[],
  filenamePrefix = "reporte-miembros"
): Promise<ExcelGenerationResult> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Reporte de Miembros");

  worksheet.columns = [
    { header: "Nombre", key: "name", width: 25 },
    { header: "Teléfono", key: "phone", width: 15 },
    { header: "Préstamo", key: "loanId", width: 12 },
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

  const borderStyle = {
    style: "thin" as const,
    color: { argb: "FFD3D3D3" }
  };

  const loanData = (loan: ExportedLoan) => ({
    paymentFrequency: loan.paymentFrequency,
    createdAt: loan.createdAt,
    payments: loan.payments
  });

  type RowData = {
    name: string;
    phone: string;
    loanId: number;
    rating: string;
    missedCount: number;
    trend: string;
    referredBy: string;
    collectionPoint: string;
    notes: string;
    highlight: "yellow" | "red" | null;
  };

  const rows: RowData[] = [];
  for (const member of members) {
    for (const loan of member.loans) {
      const data = loanData(loan);
      const rating = getPaymentRating(data);
      const missedCount = getMissedPaymentsCount(data);
      const trend = getLatenessTrend(data);
      const highlight = getReportRowHighlight(data);
      rows.push({
        name: member.name,
        phone: member.phone,
        loanId: loan.loanId,
        rating: ratingToStars(rating),
        missedCount,
        trend,
        referredBy: member.referredBy.name,
        collectionPoint: member.collectionPoint ?? "",
        notes: member.notes ?? "",
        highlight
      });
    }
  }

  rows.sort((a, b) => {
    const ratingA = a.rating.length;
    const ratingB = b.rating.length;
    if (ratingA !== ratingB) return ratingA - ratingB;
    return b.missedCount - a.missedCount;
  });

  for (const r of rows) {
    const row = worksheet.addRow({
      name: r.name,
      phone: r.phone,
      loanId: r.loanId,
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

  const loanCount = rows.length;

  // Style header row (bold, left-aligned, top-vertical-aligned)
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "left", vertical: "top" };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" } // Light gray background for header
  };

  // Add borders to header row cells
  headerRow.eachCell((cell) => {
    cell.border = {
      top: borderStyle,
      left: borderStyle,
      bottom: borderStyle,
      right: borderStyle
    };
  });

  // Generate Excel buffer
  const buffer = await workbook.xlsx.writeBuffer();
  const excelBuffer = Buffer.from(buffer);
  const filename = generateFilename(filenamePrefix);

  return {
    buffer: excelBuffer,
    filename,
    memberCount: members.length,
    loanCount
  };
}
