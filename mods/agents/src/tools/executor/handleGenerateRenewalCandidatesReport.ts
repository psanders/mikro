/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

/**
 * Handle the generateRenewalCandidatesReport tool call.
 * Generates the renewal candidates report (near-completion + completed loans, rating, AI note)
 * and sends it as a document via WhatsApp.
 * Admin only.
 */
export async function handleGenerateRenewalCandidatesReport(
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
    const { image } = await deps.generateRenewalCandidatesReport({});

    const pngBuffer = Buffer.from(image, "base64");
    logger.verbose("uploading renewal candidates report to WhatsApp", {
      size: pngBuffer.length,
      adminPhone: adminPhone.slice(-4)
    });

    const mediaId = await deps.uploadMedia(pngBuffer, "image/png");

    const dateSuffix = new Date().toISOString().slice(0, 10);

    const response = await deps.sendWhatsAppMessage({
      phone: adminPhone,
      mediaId,
      mediaType: "document",
      documentFilename: `reporte-renovacion-${dateSuffix}.png`
    });

    const messageId = response.messages?.[0]?.id;

    logger.verbose("renewal candidates report sent via WhatsApp", { messageId });

    return {
      success: true,
      message: "Reporte de candidatos a renovación enviado.",
      data: { messageId }
    };
  } catch (error) {
    const err = error as Error;
    logger.error("failed to generate or send renewal candidates report", {
      error: err.message
    });
    return {
      success: false,
      message: `Error al generar o enviar el reporte de renovación: ${err.message}`
    };
  }
}
