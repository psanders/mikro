/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

/**
 * Handle the generatePerformanceReport tool call.
 * Generates a one-page performance report (metrics + LLM narrative + PNG) and sends it via WhatsApp.
 * Admin only.
 */
export async function handleGeneratePerformanceReport(
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

  const startDate = typeof args.startDate === "string" ? args.startDate : undefined;
  const endDate = typeof args.endDate === "string" ? args.endDate : undefined;

  try {
    const { image } = await deps.generatePerformanceReport({ startDate, endDate });

    const pngBuffer = Buffer.from(image, "base64");
    logger.verbose("uploading performance report to WhatsApp", {
      size: pngBuffer.length,
      adminPhone: adminPhone.slice(-4)
    });

    const mediaId = await deps.uploadMedia(pngBuffer, "image/png");

    const response = await deps.sendWhatsAppMessage({
      phone: adminPhone,
      mediaId,
      mediaType: "image",
      caption: "Reporte de rendimiento — Mikro Créditos"
    });

    const messageId = response.messages?.[0]?.id;

    logger.verbose("performance report sent via WhatsApp", { messageId });

    return {
      success: true,
      message: "Reporte de rendimiento enviado por WhatsApp.",
      data: { messageId }
    };
  } catch (error) {
    const err = error as Error;
    logger.error("failed to generate or send performance report", {
      error: err.message
    });
    return {
      success: false,
      message: `Error al generar o enviar el reporte: ${err.message}`
    };
  }
}
