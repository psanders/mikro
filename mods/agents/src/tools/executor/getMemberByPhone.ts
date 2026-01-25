/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";
import { validatePhone } from "@mikro/common";

export async function handleGetMemberByPhone(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<ToolResult> {
  // Normalize phone number
  const phoneInput = args.phone as string;
  const normalizedPhone = validatePhone(phoneInput);

  const member = await deps.getMemberByPhone({
    phone: normalizedPhone
  });

  if (!member) {
    return {
      success: false,
      message: `Miembro no encontrado con el teléfono: ${phoneInput}`
    };
  }

  logger.verbose("member retrieved via tool by phone", {
    memberId: member.id,
    phone: normalizedPhone
  });
  return {
    success: true,
    message: "Información del miembro obtenida.",
    data: { member }
  };
}
