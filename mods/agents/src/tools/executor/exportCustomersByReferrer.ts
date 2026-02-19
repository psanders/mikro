/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";
import { generateCustomersExcel } from "./excelUtils.js";

/**
 * Handle the exportCustomersByReferrer tool call.
 * Generates a report and sends it as a document via WhatsApp.
 */
export async function handleExportCustomersByReferrer(
  deps: ToolExecutorDependencies,
  _args: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<ToolResult> {
  // Get referrer ID and phone from context
  const referrerId = context?.userId as string;
  const referrerPhone = context?.phone as string;

  if (!referrerId) {
    return {
      success: false,
      message: "ID de referidor requerido pero no disponible en el contexto"
    };
  }

  if (!referrerPhone) {
    return {
      success: false,
      message: "Numero de telefono del referidor requerido pero no disponible en el contexto"
    };
  }

  const customers = await deps.exportCustomersByReferrer({ referredById: referrerId });

  if (customers.length === 0) {
    return {
      success: true,
      message: "No hay clientes referidos por este usuario."
    };
  }

  // Generate report using shared utility
  const {
    buffer: excelBuffer,
    filename,
    customerCount,
    loanCount
  } = await generateCustomersExcel(customers, "reporte-referidos");

  logger.verbose("uploading report to WhatsApp", {
    referrerId,
    customerCount,
    loanCount,
    filename,
    size: excelBuffer.length
  });

  try {
    // Upload report to WhatsApp
    const mediaId = await deps.uploadMedia(
      excelBuffer,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    logger.verbose("report uploaded to WhatsApp", { mediaId, filename });

    // Send document via WhatsApp
    const response = await deps.sendWhatsAppMessage({
      phone: referrerPhone,
      mediaId,
      mediaType: "document",
      documentFilename: filename
    });

    const messageId = response.messages?.[0]?.id;

    logger.verbose("report sent via WhatsApp", {
      referrerId,
      customerCount,
      loanCount,
      messageId
    });

    return {
      success: true,
      message: `Reporte enviado con ${loanCount} prestamos de ${customers.length} clientes referidos.`,
      data: { messageId, filename, loanCount, customerCount: customers.length }
    };
  } catch (error) {
    const err = error as Error;
    logger.error("failed to send report via WhatsApp", {
      referrerId,
      error: err.message
    });

    return {
      success: false,
      message: `Error al enviar el reporte: ${err.message}`
    };
  }
}
