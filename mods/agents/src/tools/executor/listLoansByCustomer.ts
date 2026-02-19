/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handleListLoansByCustomer(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const loans = await deps.listLoansByCustomer({
    customerId: args.customerId as string,
    showAll: args.showAll === "true" || args.showAll === true
  });

  logger.verbose("loans listed via tool by customer", {
    customerId: args.customerId,
    count: loans.length
  });
  return {
    success: true,
    message: `Se encontraron ${loans.length} préstamos para el cliente.`,
    data: { loans }
  };
}
