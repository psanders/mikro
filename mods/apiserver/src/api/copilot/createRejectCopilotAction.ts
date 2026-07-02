/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Reject a pending copilot write (design Decision 3). Marks the action REJECTED
 * and appends a note to the thread. NOTHING is ever executed and no
 * `copilot.action` event is written. Foreign or already-resolved actions are
 * refused with structured errors.
 */
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "../../generated/prisma/client.js";

export interface RejectCopilotActionDeps {
  db: PrismaClient;
}

export interface RejectCopilotActionParams {
  userId: string;
  actionId: string;
}

export interface RejectCopilotActionResult {
  status: "REJECTED";
}

export function createRejectCopilotAction(deps: RejectCopilotActionDeps) {
  const { db } = deps;

  return async function rejectCopilotAction(
    params: RejectCopilotActionParams
  ): Promise<RejectCopilotActionResult> {
    const { userId, actionId } = params;

    const action = await db.copilotPendingAction.findUnique({ where: { id: actionId } });
    if (!action) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Acción no encontrada." });
    }
    if (action.userId !== userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Esta acción pertenece a otro usuario." });
    }
    if (action.status !== "PENDING") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `La acción ya fue resuelta (${action.status}).`
      });
    }

    await db.copilotPendingAction.update({
      where: { id: action.id },
      data: { status: "REJECTED", resolvedAt: new Date() }
    });

    await db.message.create({
      data: {
        role: "AI",
        content: "Acción rechazada. No se ejecutó ningún cambio.",
        userId,
        channel: "copilot"
      }
    });

    return { status: "REJECTED" };
  };
}
