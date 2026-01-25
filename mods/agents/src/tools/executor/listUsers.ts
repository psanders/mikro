/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handleListUsers(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<ToolResult> {
  const role = args.role as "ADMIN" | "COLLECTOR" | "REFERRER" | undefined;
  const users = await deps.listUsers(role ? { role } : undefined);

  logger.verbose("users listed via tool", { role, count: users.length });

  if (users.length === 0) {
    const roleMsg = role ? ` con rol ${role}` : "";
    return {
      success: true,
      message: `No se encontraron usuarios${roleMsg} en el sistema.`,
      data: { users: [] }
    };
  }

  // Format users for display
  const usersList = users
    .map((u) => {
      const roles = u.roles?.map((r) => r.role).join(", ") || "Sin roles";
      return `- ${u.name} (ID: ${u.id}, Tel: ${u.phone}, Roles: ${roles})`;
    })
    .join("\n");

  const roleMsg = role ? ` con rol ${role}` : "";
  return {
    success: true,
    message: `Usuarios disponibles${roleMsg}:\n${usersList}`,
    data: { users }
  };
}
