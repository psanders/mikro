/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handleUpdateLoanStatus(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const loanId = Number(args.loanId);
  const status = args.status as "COMPLETED" | "DEFAULTED" | "CANCELLED";

  const result = await deps.updateLoanStatus({ loanId, status });

  logger.verbose("loan status updated via tool", { loanId: result.loanId, status: result.status });
  return {
    success: true,
    message: `Estado del préstamo #${result.loanId} actualizado a ${result.status}.`,
    data: { id: result.id, loanId: result.loanId, status: result.status }
  };
}
