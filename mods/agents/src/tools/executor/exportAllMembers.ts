/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";
import { generateMembersExcel } from "./excelUtils.js";

/**
 * Handle the exportAllMembers tool call.
 * Generates a report of all active members and sends it as a document via WhatsApp.
 * This is an admin-only operation.
 */
export async function handleExportAllMembers(
  deps: ToolExecutorDependencies,
  _args: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<ToolResult> {
  // Get admin ID and phone from context
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

  const members = await deps.exportAllMembers();

  if (members.length === 0) {
    return {
      success: true,
      message: "No hay miembros activos en el sistema."
    };
  }

  // Generate report using shared utility
  const {
    buffer: excelBuffer,
    filename,
    memberCount,
    loanCount
  } = await generateMembersExcel(members, "reporte-todos-miembros");

  logger.verbose("uploading report to WhatsApp", {
    adminId,
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
      phone: adminPhone,
      mediaId,
      mediaType: "document",
      documentFilename: filename
    });

    const messageId = response.messages?.[0]?.id;

    logger.verbose("report sent via WhatsApp", {
      adminId,
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
      adminId,
      error: err.message
    });

    return {
      success: false,
      message: `Error al enviar el reporte: ${err.message}`
    };
  }
}
