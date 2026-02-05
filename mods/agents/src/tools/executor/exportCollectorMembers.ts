/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";
import { generateMembersExcel } from "./excelUtils.js";

export { generateFilename, type ExportedMember, type ExportedLoan } from "./excelUtils.js";

/**
 * Handle the exportCollectorMembers tool call.
 * Generates a report and sends it as a document via WhatsApp.
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

  // Generate report using shared utility
  const {
    buffer: excelBuffer,
    filename,
    memberCount,
    loanCount
  } = await generateMembersExcel(members, "reporte-cobrador");

  logger.verbose("uploading report to WhatsApp", {
    collectorId,
    memberCount,
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
      phone: collectorPhone,
      mediaId,
      mediaType: "document",
      documentFilename: filename
    });

    const messageId = response.messages?.[0]?.id;

    logger.verbose("report sent via WhatsApp", {
      collectorId,
      memberCount,
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
    logger.error("failed to send report via WhatsApp", {
      collectorId,
      error: err.message
    });

    return {
      success: false,
      message: `Error al enviar el reporte: ${err.message}`
    };
  }
}
