/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handleRejectApplication(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<ToolResult> {
  if (!deps.rejectApplication) {
    return { success: false, message: "rejectApplication no está configurada." };
  }
  const id = args.id as string | undefined;
  const reviewerId = context?.userId as string | undefined;
  if (!reviewerId) {
    return { success: false, message: "No se pudo identificar al revisor." };
  }

  const reason = typeof args.reason === "string" ? args.reason.trim() : "";
  if (!reason) {
    return { success: false, message: "El motivo del rechazo es obligatorio." };
  }

  const app = await deps.rejectApplication({ id, reason }, reviewerId);

  logger.verbose("application rejected via tool", { applicationId: app.id, reviewerId });
  return {
    success: true,
    message: `Solicitud ${app.id} rechazada. Motivo: ${reason}`,
    data: { id: app.id, status: app.status }
  };
}
