/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Confirm a pending copilot write (design Decision 3). Re-validates ownership,
 * PENDING status, and age (< COPILOT_ACTION_EXPIRY_MINUTES) BEFORE executing the
 * tool through the shared executor. On success it records a single `copilot.action`
 * business event (intrinsic — no boundary mapper, like `application.restored`),
 * marks the action CONFIRMED, and appends the outcome to the thread. Expired
 * actions are flipped to EXPIRED and refused; foreign or already-resolved actions
 * are refused with structured errors and nothing executes.
 */
import { TRPCError } from "@trpc/server";
import { COPILOT_ACTION_EXPIRY_MINUTES } from "@mikro/common";
import type { ToolExecutor } from "@mikro/agents";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { recordEvent } from "../events/recordEvent.js";

export interface ConfirmCopilotActionDeps {
  db: PrismaClient;
  toolExecutor: ToolExecutor;
}

export interface ConfirmCopilotActionParams {
  userId: string;
  actorName?: string;
  actionId: string;
}

export interface ConfirmCopilotActionResult {
  status: "CONFIRMED";
  reply: string;
  eventId: string;
}

export function createConfirmCopilotAction(deps: ConfirmCopilotActionDeps) {
  const { db, toolExecutor } = deps;

  return async function confirmCopilotAction(
    params: ConfirmCopilotActionParams
  ): Promise<ConfirmCopilotActionResult> {
    const { userId, actorName, actionId } = params;

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

    const ageMinutes = (Date.now() - action.createdAt.getTime()) / 60000;
    if (ageMinutes > COPILOT_ACTION_EXPIRY_MINUTES) {
      await db.copilotPendingAction.update({
        where: { id: action.id },
        data: { status: "EXPIRED", resolvedAt: new Date() }
      });
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "La acción expiró. Pídele al copiloto que la proponga de nuevo."
      });
    }

    const args = JSON.parse(action.argsJson) as Record<string, unknown>;
    const result = await toolExecutor(action.toolName, args, {
      userId,
      role: "ADMIN",
      name: actorName
    });

    if (!result.success) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: result.message || "No se pudo ejecutar la acción."
      });
    }

    const created = await recordEvent(db, {
      type: "copilot.action",
      actorId: userId,
      actorName: actorName ?? "Fundador",
      summary: action.summary,
      payload: { toolName: action.toolName, args, resultSummary: result.message }
    });

    await db.copilotPendingAction.update({
      where: { id: action.id },
      data: { status: "CONFIRMED", resolvedAt: new Date() }
    });

    const reply = `Hecho. ${result.message}`.trim();
    await db.message.create({
      data: { role: "AI", content: reply, userId, channel: "copilot" }
    });

    return { status: "CONFIRMED", reply, eventId: created.id };
  };
}
