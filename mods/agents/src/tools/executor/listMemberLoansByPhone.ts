/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";
import { validatePhone } from "@mikro/common";

export async function handleListMemberLoansByPhone(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>
): Promise<ToolResult> {
  // Normalize phone number
  const phoneInput = args.phone as string;
  const normalizedPhone = validatePhone(phoneInput);

  // First get the member by phone
  const member = await deps.getMemberByPhone({
    phone: normalizedPhone
  });

  if (!member) {
    return {
      success: false,
      message: `Miembro no encontrado con el teléfono: ${phoneInput}`
    };
  }

  // Then list loans for that member
  const loans = await deps.listLoansByMember({
    memberId: member.id,
    showAll: args.showAll === "true" || args.showAll === true
  });

  logger.verbose("loans listed via tool by phone", {
    phone: normalizedPhone,
    memberId: member.id,
    count: loans.length
  });
  return {
    success: true,
    message: `Se encontraron ${loans.length} préstamos para ${member.name}.`,
    data: { member, loans }
  };
}
