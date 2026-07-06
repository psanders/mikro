/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";
import { validatePhone } from "@mikro/common";

export async function handleGetCustomerByPhone(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>
): Promise<ToolResult> {
  // Normalize phone number
  const phoneInput = args.phone as string;
  const normalizedPhone = validatePhone(phoneInput);

  const customer = await deps.getCustomerByPhone({
    phone: normalizedPhone
  });

  if (!customer) {
    return {
      success: false,
      message: `Cliente no encontrado con el teléfono: ${phoneInput}`,
      reason: "NOT_FOUND"
    };
  }

  logger.verbose("customer retrieved via tool by phone", {
    customerId: customer.id,
    phone: normalizedPhone
  });
  return {
    success: true,
    message: "Información del cliente obtenida.",
    data: { customer }
  };
}
