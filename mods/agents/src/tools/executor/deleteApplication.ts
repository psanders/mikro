/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handleDeleteApplication(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<ToolResult> {
  if (!deps.deleteApplication) {
    return { success: false, message: "deleteApplication no está configurada." };
  }
  const id = args.id as string | undefined;
  const reviewerId = context?.userId as string | undefined;
  if (!reviewerId) {
    return { success: false, message: "No se pudo identificar al revisor." };
  }

  const app = await deps.deleteApplication({ id }, reviewerId);

  logger.verbose("application deleted via tool", { applicationId: app.id, reviewerId });
  return {
    success: true,
    message: `Solicitud ${app.id} eliminada permanentemente.`,
    data: { id: app.id }
  };
}
