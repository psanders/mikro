/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handleForceQCobroSync(
  deps: ToolExecutorDependencies,
  _args: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<ToolResult> {
  if (!deps.forceQCobroSync) {
    return { success: false, message: "forceQCobroSync no está configurada." };
  }

  const actorName = context?.name as string | undefined;
  const result = await deps.forceQCobroSync(actorName);

  logger.verbose("qcobro force sync executed", result);
  return {
    success: true,
    message: `Sincronización con QCobro completada: ${result.customers} clientes procesados, ${result.portfoliosPushed} portafolios enviados, ${result.portfoliosSkipped} omitidos (${result.durationMs} ms).`,
    data: { ...result }
  };
}
