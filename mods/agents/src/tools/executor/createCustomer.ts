/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handleCreateCustomer(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<ToolResult> {
  // Get phone from context (set by router based on WhatsApp sender)
  const phone = (context?.phone as string) || (args.phone as string);
  if (!phone) {
    return {
      success: false,
      message: "Phone number is required but not available in context"
    };
  }

  const referredById = (args.referredById as string | null | undefined) ?? null;

  const customer = await deps.createCustomer({
    name: args.name as string,
    phone,
    idNumber: args.idNumber as string,
    collectionPoint: args.collectionPoint as string | undefined,
    homeAddress: args.homeAddress as string,
    referredById,
    jobPosition: args.jobPosition as string | undefined,
    income: args.income ? Number(args.income) : undefined,
    isBusinessOwner: args.isBusinessOwner === "true" || args.isBusinessOwner === true,
    preferredPaymentDay: (args.preferredPaymentDay as string) || undefined
  });

  logger.verbose("customer created via tool", { customerId: customer.id });

  // Extract first name for friendly message
  const firstName = customer.name.split(" ")[0];
  return {
    success: true,
    message: `Estimado ${firstName}, registramos su información y el equipo se pondrá en contacto pronto.`,
    data: { customerId: customer.id, name: customer.name }
  };
}
