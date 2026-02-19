/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";
import { validatePhone } from "@mikro/common";

export async function handleListCustomerLoansByPhone(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>
): Promise<ToolResult> {
  // Normalize phone number
  const phoneInput = args.phone as string;
  const normalizedPhone = validatePhone(phoneInput);

  // First get the customer by phone
  const customer = await deps.getCustomerByPhone({
    phone: normalizedPhone
  });

  if (!customer) {
    return {
      success: false,
      message: `Cliente no encontrado con el teléfono: ${phoneInput}`
    };
  }

  // Then list loans for that customer
  const loans = await deps.listLoansByCustomer({
    customerId: customer.id,
    showAll: args.showAll === "true" || args.showAll === true
  });

  logger.verbose("loans listed via tool by phone", {
    phone: normalizedPhone,
    customerId: customer.id,
    count: loans.length
  });
  return {
    success: true,
    message: `Se encontraron ${loans.length} préstamos para ${customer.name}.`,
    data: { customer, loans }
  };
}
