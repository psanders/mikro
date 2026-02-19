/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

/**
 * Handle the generateDefaultedReport tool call.
 * Generates a defaulted-loans report (PNG with AI note summaries) and sends it
 * as a document via WhatsApp to preserve image quality.
 * Admin only.
 */
export async function handleGenerateDefaultedReport(
  deps: ToolExecutorDependencies,
  _args: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<ToolResult> {
  const adminPhone = context?.phone as string;

  if (!adminPhone) {
    return {
      success: false,
      message: "Numero de telefono del admin requerido pero no disponible en el contexto"
    };
  }

  try {
    const { image } = await deps.generateDefaultedReport({});

    const pngBuffer = Buffer.from(image, "base64");
    logger.verbose("uploading defaulted report to WhatsApp", {
      size: pngBuffer.length,
      adminPhone: adminPhone.slice(-4)
    });

    const mediaId = await deps.uploadMedia(pngBuffer, "image/png");

    const dateSuffix = new Date().toISOString().slice(0, 10);

    const response = await deps.sendWhatsAppMessage({
      phone: adminPhone,
      mediaId,
      mediaType: "document",
      documentFilename: `reporte-mora-${dateSuffix}.png`
    });

    const messageId = response.messages?.[0]?.id;

    logger.verbose("defaulted report sent via WhatsApp", { messageId });

    return {
      success: true,
      message: "Reporte de mora enviado.",
      data: { messageId }
    };
  } catch (error) {
    const err = error as Error;
    logger.error("failed to generate or send defaulted report", {
      error: err.message
    });
    return {
      success: false,
      message: `Error al generar o enviar el reporte de mora: ${err.message}`
    };
  }
}
