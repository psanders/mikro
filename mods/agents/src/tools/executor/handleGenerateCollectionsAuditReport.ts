/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

/**
 * Handle the generateCollectionsAuditReport tool call.
 * Generates the daily collections audit report (who was notified, type, status, errors)
 * and sends it as a document via WhatsApp. Admin only.
 */
export async function handleGenerateCollectionsAuditReport(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<ToolResult> {
  const adminPhone = context?.phone as string;

  if (!adminPhone) {
    return {
      success: false,
      message: "Numero de telefono del admin requerido pero no disponible en el contexto"
    };
  }

  const dateArg = typeof args.date === "string" && args.date.trim() ? args.date.trim() : undefined;

  try {
    const { image } = await deps.generateCollectionsAuditReport(
      dateArg ? { date: dateArg } : undefined
    );

    const pngBuffer = Buffer.from(image, "base64");
    logger.verbose("uploading collections audit report to WhatsApp", {
      size: pngBuffer.length,
      adminPhone: adminPhone.slice(-4),
      date: dateArg ?? "today"
    });

    const mediaId = await deps.uploadMedia(pngBuffer, "image/png");

    const dateSuffix = dateArg ?? new Date().toISOString().slice(0, 10);

    const response = await deps.sendWhatsAppMessage({
      phone: adminPhone,
      mediaId,
      mediaType: "document",
      documentFilename: `auditoria-cobranza-${dateSuffix}.png`
    });

    const messageId = response.messages?.[0]?.id;

    logger.verbose("collections audit report sent via WhatsApp", { messageId });

    return {
      success: true,
      message: "Reporte de auditoría de cobranza enviado.",
      data: { messageId }
    };
  } catch (error) {
    const err = error as Error;
    logger.error("failed to generate or send collections audit report", {
      error: err.message
    });
    return {
      success: false,
      message: `Error al generar o enviar el reporte de auditoría: ${err.message}`
    };
  }
}
