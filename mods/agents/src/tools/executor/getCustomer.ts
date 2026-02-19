/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handleGetCustomer(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const customer = await deps.getCustomer({
    id: args.customerId as string
  });

  if (!customer) {
    return {
      success: false,
      message: `Cliente no encontrado: ${args.customerId}`
    };
  }

  logger.verbose("customer retrieved via tool", { customerId: customer.id });
  return {
    success: true,
    message: "Información del cliente obtenida.",
    data: { customer }
  };
}
