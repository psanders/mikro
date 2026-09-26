/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handleRunConversationAudit(
  deps: ToolExecutorDependencies,
  _args: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<ToolResult> {
  if (!deps.runConversationAudit) {
    return { success: false, message: "runConversationAudit no está configurada." };
  }

  const actorName = (context?.name as string | undefined) || "Fundador";
  try {
    const r = await deps.runConversationAudit(actorName);
    logger.verbose("conversation audit run from copilot", { runId: r.runId });
    const problems = r.criticalCount + r.warningCount;
    const found =
      problems === 0
        ? "no encontré problemas"
        : `encontré ${r.criticalCount} crítico(s) y ${r.warningCount} advertencia(s)`;
    return {
      success: true,
      message: `Auditoría completada: revisé ${r.conversations} conversaciones y ${found}. ${r.handoffs} pasaron a persona. La tarjeta quedó en el feed.`,
      data: { ...r }
    };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}
