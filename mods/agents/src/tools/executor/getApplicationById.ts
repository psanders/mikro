/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handleGetApplicationById(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const id = args.id as string;
  const application = await deps.getApplication({ id });

  if (!application) {
    return {
      success: false,
      message: `Solicitud no encontrada con el ID: ${id}`,
      reason: "NOT_FOUND"
    };
  }

  logger.verbose("application retrieved via tool by id", { applicationId: application.id });
  return {
    success: true,
    message: "Información de la solicitud obtenida.",
    data: { application }
  };
}
