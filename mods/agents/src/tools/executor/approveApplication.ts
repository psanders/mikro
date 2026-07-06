/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handleApproveApplication(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<ToolResult> {
  if (!deps.approveApplication) {
    return { success: false, message: "approveApplication no está configurada." };
  }
  const id = args.id as string | undefined;
  const reviewerId = context?.userId as string | undefined;
  if (!reviewerId) {
    return { success: false, message: "No se pudo identificar al revisor." };
  }

  const note = typeof args.note === "string" ? args.note : undefined;
  const app = await deps.approveApplication({ id, note }, reviewerId);

  logger.verbose("application approved via tool", { applicationId: app.id, reviewerId });
  return {
    success: true,
    message: `Solicitud ${app.id} aprobada.`,
    data: { id: app.id, status: app.status }
  };
}
