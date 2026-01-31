/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared utilities for generating Excel member reports.
 */
import ExcelJS from "exceljs";
import { calculatePaymentStatus, type LoanPaymentStatus } from "@mikro/common";
import type { ExportedMember, ExportedLoan } from "./types.js";

// Re-export types for backwards compatibility
export { calculatePaymentStatus, type LoanPaymentStatus };
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

/**
 * Get background color for payment status (only for late statuses).
 */
function getStatusColor(status: LoanPaymentStatus): { argb: string } | null {
  switch (status) {
    case "AL DIA":
      return null; // No background color for on-time
    case "ATRASADO":
      return { argb: "FFFFF4E6" }; // Light orange/yellow
    case "MUY ATRASADO":
      return { argb: "FFFFEBEE" }; // Light red
    default:
      return null;
  }
}

/**
 * Generate an Excel report from member data.
 *
 * @param members - Array of member data with loans
 * @param filenamePrefix - Optional prefix for the filename (default: "reporte-miembros")
 * @returns Excel buffer, filename, and counts
 */
export async function generateMembersExcel(
  members: ExportedMember[],
  filenamePrefix = "reporte-miembros"
): Promise<ExcelGenerationResult> {
  // Create Excel workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Reporte de Miembros");

  // Define columns with headers and widths
  worksheet.columns = [
    { header: "Nombre", key: "name", width: 25 },
    { header: "Teléfono", key: "phone", width: 15 },
    { header: "Préstamo", key: "loanId", width: 12 },
    { header: "Afiliado por", key: "referredBy", width: 20 },
    { header: "Lugar de Cobro", key: "collectionPoint", width: 36 },
    { header: "Estado", key: "status", width: 15 },
    { header: "Notas", key: "notes", width: 25 }
  ];

  // Set left alignment and top vertical alignment for all columns
  worksheet.columns.forEach((column) => {
    column.alignment = { horizontal: "left", vertical: "top" };
  });

  // Enable text wrapping for member notes column
  const notasColumn = worksheet.getColumn("notes");
  if (notasColumn) {
    notasColumn.alignment = { horizontal: "left", vertical: "top", wrapText: true };
  }

  // Define border style for gridlines (used throughout the worksheet)
  const borderStyle = {
    style: "thin" as const,
    color: { argb: "FFD3D3D3" } // Light gray
  };

  // Add data rows
  let loanCount = 0;
  for (const member of members) {
    for (const loan of member.loans) {
      const status = calculatePaymentStatus(loan);
      const row = worksheet.addRow({
        name: member.name,
        phone: member.phone,
        loanId: loan.loanId,
        referredBy: member.referredBy.name,
        collectionPoint: member.collectionPoint ?? "",
        status: status,
        notes: member.notes ?? ""
      });

      // Get status color for row highlighting (only for late statuses)
      const statusColor = getStatusColor(status);

      // Apply top vertical alignment, row coloring, and borders to all cells in the row
      row.eachCell((cell, colNumber) => {
        const columnKey = worksheet.getColumn(colNumber).key;
        const shouldWrap = columnKey === "notes";
        cell.alignment = { horizontal: "left", vertical: "top", wrapText: shouldWrap };

        // Apply borders to maintain gridlines
        cell.border = {
          top: borderStyle,
          left: borderStyle,
          bottom: borderStyle,
          right: borderStyle
        };

        // Apply background color to entire row for late statuses
        if (statusColor) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: statusColor
          };
        }
      });

      // Make status cell bold
      const statusCell = row.getCell("status");
      statusCell.font = { bold: true };

      loanCount++;
    }
  }

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
