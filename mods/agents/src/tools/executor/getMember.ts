/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handleGetMember(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const member = await deps.getMember({
    id: args.memberId as string
  });

  if (!member) {
    return {
      success: false,
      message: `Miembro no encontrado: ${args.memberId}`
    };
  }

  logger.verbose("member retrieved via tool", { memberId: member.id });
  return {
    success: true,
    message: "Información del miembro obtenida.",
    data: { member }
  };
}
