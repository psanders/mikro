/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";
import { generateCustomersExcel, generateFilename } from "./excelUtils.js";

/**
 * Handle the exportAllCustomers tool call.
 * Default: simplified (PNG image grouped by payment health). With format "detailed": Excel with all columns.
 * Sends the report as a document via WhatsApp. Admin-only.
 */
export async function handleExportAllCustomers(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<ToolResult> {
  const adminId = context?.userId as string;
  const adminPhone = context?.phone as string;

  if (!adminId) {
    return {
      success: false,
      message: "ID de admin requerido pero no disponible en el contexto"
    };
  }

  if (!adminPhone) {
    return {
      success: false,
      message: "Numero de telefono del admin requerido pero no disponible en el contexto"
    };
  }

  const customers = await deps.exportAllCustomers();

  if (customers.length === 0) {
    return {
      success: true,
      message: "No hay clientes activos en el sistema."
    };
  }

  const format = (args?.format as string) ?? "simplified";
  const isDetailed = format === "detailed";

  if (isDetailed) {
    const {
      buffer: excelBuffer,
      filename,
      customerCount,
      loanCount
    } = await generateCustomersExcel(customers, "reporte-todos-clientes");

    logger.verbose("uploading report to WhatsApp", {
      adminId,
      customerCount,
      loanCount,
      filename,
      size: excelBuffer.length
    });

    try {
      const mediaId = await deps.uploadMedia(
        excelBuffer,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      logger.verbose("report uploaded to WhatsApp", { mediaId, filename });
      const response = await deps.sendWhatsAppMessage({
        phone: adminPhone,
        mediaId,
        mediaType: "document",
        documentFilename: filename
      });
      const messageId = response.messages?.[0]?.id;
      logger.verbose("report sent via WhatsApp", {
        adminId,
        customerCount,
        loanCount,
        messageId
      });
      return {
        success: true,
        message: `Reporte enviado con ${loanCount} prestamos de ${customers.length} clientes.`,
        data: { messageId, filename, loanCount, customerCount: customers.length }
      };
    } catch (error) {
      const err = error as Error;
      logger.error("failed to send report via WhatsApp", {
        adminId,
        error: err.message
      });
      return {
        success: false,
        message: `Error al enviar el reporte: ${err.message}`
      };
    }
  }

  // Simplified: PNG report grouped by payment health
  try {
    const pngBuffer = await deps.renderCustomersReportToPng(customers);
    const filename = generateFilename("reporte-clientes").replace(".xlsx", ".png");

    logger.verbose("uploading simplified report to WhatsApp", {
      adminId,
      customerCount: customers.length,
      filename,
      size: pngBuffer.length
    });

    const mediaId = await deps.uploadMedia(pngBuffer, "image/png");
    logger.verbose("report uploaded to WhatsApp", { mediaId, filename });
    const response = await deps.sendWhatsAppMessage({
      phone: adminPhone,
      mediaId,
      mediaType: "document",
      documentFilename: filename
    });
    const messageId = response.messages?.[0]?.id;
    const loanCount = customers.reduce((sum, m) => sum + m.loans.length, 0);
    logger.verbose("report sent via WhatsApp", {
      adminId,
      customerCount: customers.length,
      loanCount,
      messageId
    });
    return {
      success: true,
      message: `Reporte enviado con ${loanCount} prestamos de ${customers.length} clientes.`,
      data: { messageId, filename, loanCount, customerCount: customers.length }
    };
  } catch (error) {
    const err = error as Error;
    logger.error("failed to send simplified report via WhatsApp", {
      adminId,
      error: err.message
    });
    return {
      success: false,
      message: `Error al enviar el reporte: ${err.message}`
    };
  }
}
