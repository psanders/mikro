/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import ExcelJS from "exceljs";
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

/**
 * Loan with payments for days late calculation.
 */
interface LoanWithPayments {
  loanId: number;
  notes: string | null;
  paymentFrequency: string;
  createdAt: Date;
  payments: Array<{ paidAt: Date }>;
}

/**
 * Calculate how many days late a loan payment is.
 * Returns 0 if the loan is current ("Al dia").
 */
function calculateDaysLate(loan: LoanWithPayments): number {
  const lastPaymentDate = loan.payments[0]?.paidAt ?? loan.createdAt;
  const intervalDays = loan.paymentFrequency === "DAILY" ? 1 : 7;

  const nextDueDate = new Date(lastPaymentDate);
  nextDueDate.setDate(nextDueDate.getDate() + intervalDays);

  const today = new Date();
  const diffMs = today.getTime() - nextDueDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
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
    { header: "Nombre", key: "nombre", width: 25 },
    { header: "Telefono", key: "telefono", width: 15 },
    { header: "Prestamo", key: "prestamo", width: 12 },
    { header: "Referidor", key: "referidor", width: 20 },
    { header: "Punto de Cobro", key: "punto", width: 36 },
    { header: "Notas del Miembro", key: "notasMiembro", width: 25 },
    { header: "Notas del Prestamo", key: "notasPrestamo", width: 25 },
    { header: "Dias de Atraso", key: "diasAtraso", width: 15 }
  ];

  // Set left alignment for all columns
  worksheet.columns.forEach((column) => {
    column.alignment = { horizontal: "left" };
  });

  // Add data rows
  let loanCount = 0;
  for (const member of members) {
    for (const loan of member.loans) {
      const daysLate = calculateDaysLate(loan);
      worksheet.addRow({
        nombre: member.name,
        telefono: member.phone,
        prestamo: loan.loanId,
        referidor: member.referredBy.name,
        punto: member.collectionPoint ?? "",
        notasMiembro: member.notes ?? "",
        notasPrestamo: loan.notes ?? "",
        diasAtraso: daysLate === 0 ? "Al dia" : `${daysLate} dias`
      });
      loanCount++;
    }
  }

  // Style header row (bold, left-aligned)
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "left" };

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
