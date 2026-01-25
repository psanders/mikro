/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handleListLoansByCollector(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<ToolResult> {
  // Get collector ID from context
  const collectorId = context?.userId as string;
  if (!collectorId) {
    return {
      success: false,
      message: "Collector ID is required but not available in context"
    };
  }

  const loans = await deps.listLoansByCollector({
    assignedCollectorId: collectorId,
    showAll: args.showAll === "true" || args.showAll === true
  });

  logger.verbose("loans listed via tool", { count: loans.length });
  return {
    success: true,
    message: `Se encontraron ${loans.length} préstamos.`,
    data: { loans }
  };
}
