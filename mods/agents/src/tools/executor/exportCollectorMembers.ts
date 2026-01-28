/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import ExcelJS from "exceljs";
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

/**
 * Loan with payments for payment status calculation.
 */
export interface LoanWithPayments {
  loanId: number;
  notes: string | null;
  paymentFrequency: string;
  createdAt: Date;
  termLength: number;
  payments: Array<{ paidAt: Date }>;
}

/**
 * Payment status based on cycle comparison.
 */
export type PaymentStatus = "AL DIA" | "ATRASADO" | "MUY ATRASADO";

/**
 * Calculate payment status by comparing elapsed cycles since loan creation
 * against completed payments. For SAN-type loans with fixed intervals.
 */
export function calculatePaymentStatus(loan: LoanWithPayments): PaymentStatus {
  const intervalDays = loan.paymentFrequency === "DAILY" ? 1 : 7;
  const today = new Date();
  const loanStart = new Date(loan.createdAt);

  // Calculate elapsed cycles since loan creation
  const msSinceLoan = today.getTime() - loanStart.getTime();
  const daysSinceLoan = Math.floor(msSinceLoan / (1000 * 60 * 60 * 24));
  const cyclesElapsed = Math.floor(daysSinceLoan / intervalDays);

  // Count payments made
  const paymentsMade = loan.payments.length;

  const missedCycles = cyclesElapsed - paymentsMade;

  if (missedCycles <= 0) return "AL DIA";
  if (missedCycles === 1) return "ATRASADO";
  return "MUY ATRASADO";
}

/**
 * Generate a filename for the Excel report.
 */
function generateFilename(): string {
  const now = new Date();
  const date = now.toISOString().split("T")[0]; // YYYY-MM-DD
  return `reporte-miembros-${date}.xlsx`;
}

/**
 * Handle the exportCollectorMembers tool call.
 * Generates an Excel report and sends it as a document via WhatsApp.
 */
export async function handleExportCollectorMembers(
  deps: ToolExecutorDependencies,
  _args: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<ToolResult> {
  // Get collector ID and phone from context
  const collectorId = context?.userId as string;
  const collectorPhone = context?.phone as string;

  if (!collectorId) {
    return {
      success: false,
      message: "ID de cobrador requerido pero no disponible en el contexto"
    };
  }

  if (!collectorPhone) {
    return {
      success: false,
      message: "Numero de telefono del cobrador requerido pero no disponible en el contexto"
    };
  }

  const members = await deps.exportCollectorMembers({ assignedCollectorId: collectorId });

  if (members.length === 0) {
    return {
      success: true,
      message: "No hay miembros asignados a este cobrador."
    };
  }

  // Create Excel workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Reporte de Miembros");

  // Define columns with headers and widths
  worksheet.columns = [
    { header: "Nombre", key: "name", width: 25 },
    { header: "Teléfono", key: "phone", width: 15 },
    { header: "Préstamo", key: "loanId", width: 12 },
    { header: "Afiliado por", key: "referredBy", width: 20 },
    { header: "Punto de Cobro", key: "collectionPoint", width: 36 },
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

  // Helper function to get status color (only for late statuses)
  function getStatusColor(status: PaymentStatus): { argb: string } | null {
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
  const filename = generateFilename();

  logger.verbose("uploading Excel report to WhatsApp", {
    collectorId,
    memberCount: members.length,
    loanCount,
    filename,
    size: excelBuffer.length
  });

  try {
    // Upload Excel to WhatsApp
    const mediaId = await deps.uploadMedia(
      excelBuffer,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    logger.verbose("Excel uploaded to WhatsApp", { mediaId, filename });

    // Send document via WhatsApp
    const response = await deps.sendWhatsAppMessage({
      phone: collectorPhone,
      mediaId,
      mediaType: "document",
      documentFilename: filename
    });

    const messageId = response.messages?.[0]?.id;

    logger.verbose("Excel report sent via WhatsApp", {
      collectorId,
      memberCount: members.length,
      loanCount,
      messageId
    });

    return {
      success: true,
      message: `Reporte enviado con ${loanCount} prestamos de ${members.length} miembros.`,
      data: { messageId, filename, loanCount, memberCount: members.length }
    };
  } catch (error) {
    const err = error as Error;
    logger.error("failed to send Excel report via WhatsApp", {
      collectorId,
      error: err.message
    });

    return {
      success: false,
      message: `Error al enviar el reporte: ${err.message}`
    };
  }
}
