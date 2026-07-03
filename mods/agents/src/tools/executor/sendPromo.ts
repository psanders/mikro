/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handleSendPromo(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const phone = args.phone as string | undefined;
  if (!phone) {
    return { success: false, message: "Falta el número de teléfono." };
  }

  const result = await deps.sendPromo({ phone });
  if (!result.sent) {
    return {
      success: false,
      message: `No se pudo enviar la promoción: ${result.error ?? "error desconocido"}.`
    };
  }

  logger.verbose("promo sent via tool", { phone, messageId: result.messageId });
  return {
    success: true,
    message: `Promoción enviada a ${phone}.${
      result.messageId ? ` ID del mensaje: ${result.messageId}` : ""
    }`,
    data: { messageId: result.messageId }
  };
}
