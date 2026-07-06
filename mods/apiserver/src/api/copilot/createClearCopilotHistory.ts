/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Clear the founder's copilot conversation (design decision: soft-delete, not
 * hard-delete). Marks every copilot-channel `Message` row and every resolved
 * `CopilotPendingAction` owned by the caller with `deletedAt` — the rows are
 * never removed, only excluded from history reads
 * (`createGetCopilotHistory`, `createCopilotChat`). Refuses to clear
 * while the caller has a PENDING, unexpired `CopilotPendingAction`: a write the
 * founder hasn't resolved yet must never be silently hidden from view.
 */
import { TRPCError } from "@trpc/server";
import { COPILOT_ACTION_EXPIRY_MINUTES } from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";

export interface ClearCopilotHistoryDeps {
  db: PrismaClient;
}

export interface ClearCopilotHistoryParams {
  userId: string;
}

export interface ClearCopilotHistoryResult {
  cleared: number;
}

export function createClearCopilotHistory(deps: ClearCopilotHistoryDeps) {
  const { db } = deps;

  return async function clearCopilotHistory(
    params: ClearCopilotHistoryParams
  ): Promise<ClearCopilotHistoryResult> {
    const { userId } = params;

    const expiryCutoff = new Date(Date.now() - COPILOT_ACTION_EXPIRY_MINUTES * 60 * 1000);
    const pending = await db.copilotPendingAction.findFirst({
      where: { userId, status: "PENDING", createdAt: { gt: expiryCutoff } }
    });
    if (pending) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Resuelve la acción pendiente antes de borrar el historial."
      });
    }

    const now = new Date();
    const { count } = await db.message.updateMany({
      where: { userId, channel: "copilot", deletedAt: null },
      data: { deletedAt: now }
    });

    // Resolved (or expired) action cards belong to the conversation being
    // cleared — hide them too, or they resurface alone on the next reload.
    await db.copilotPendingAction.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now }
    });

    return { cleared: count };
  };
}
