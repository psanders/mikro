/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

/**
 * Handle the generateDefaultedReport tool call.
 * Generates the at-risk loans report (defaulted + red-highlighted late, PNG with AI note summaries)
 * and sends it as a document via WhatsApp to preserve image quality.
 * Admin only.
 */
export async function handleGenerateDefaultedReport(
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

  const filter: "all" | "defaulted" | "late" =
    typeof args.filter === "string" && ["all", "defaulted", "late"].includes(args.filter)
      ? (args.filter as "all" | "defaulted" | "late")
      : "all";

  try {
    const { image } = await deps.generateDefaultedReport({ filter });

    const pngBuffer = Buffer.from(image, "base64");
    logger.verbose("uploading at-risk report to WhatsApp", {
      size: pngBuffer.length,
      adminPhone: adminPhone.slice(-4)
    });

    const mediaId = await deps.uploadMedia(pngBuffer, "image/png");

    const dateSuffix = new Date().toISOString().slice(0, 10);

    const response = await deps.sendWhatsAppMessage({
      phone: adminPhone,
      mediaId,
      mediaType: "document",
      documentFilename: `reporte-riesgo-${dateSuffix}.png`
    });

    const messageId = response.messages?.[0]?.id;

    logger.verbose("at-risk report sent via WhatsApp", { messageId });

    return {
      success: true,
      message: "Reporte de cartera en riesgo enviado.",
      data: { messageId }
    };
  } catch (error) {
    const err = error as Error;
    logger.error("failed to generate or send at-risk report", {
      error: err.message
    });
    return {
      success: false,
      message: `Error al generar o enviar el reporte de riesgo: ${err.message}`
    };
  }
}
