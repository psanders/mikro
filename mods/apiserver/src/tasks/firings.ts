/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Firing lifecycle core, shared by the worker (fire + auto-gate execution)
 * and the tRPC confirm/skip procedures. No LLM anywhere in this path.
 *
 * Event convention: task.* events are written immediately after their
 * mutation commits; an event-write failure is logged without failing the
 * operation (the same boundary stance as the rest of the event log).
 */
import { ValidationError } from "@mikro/common";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { TaskFiring } from "../generated/prisma/client.js";
import { createCreateTransaction } from "../api/accounting/index.js";
import { recordEvent } from "../api/events/recordEvent.js";
import { logger } from "../logger.js";
import type { Automation, ResolveContext } from "./types.js";
import { getAutomation } from "./catalog.js";
import { validateSlots, slotNames } from "./validatePayload.js";

/** Statuses in which a firing still awaits the founder. */
export const OPEN_FIRING_STATUSES = ["READY", "NEEDS_INPUT"] as const;

function taskEventPayload(firing: TaskFiring) {
  return {
    taskFiringId: firing.id,
    automationId: firing.automationId,
    taskName: firing.taskName
  };
}

async function recordTaskEvent(
  db: PrismaClient,
  input: Parameters<typeof recordEvent>[1]
): Promise<void> {
  try {
    await recordEvent(db, input);
  } catch (err) {
    logger.error("task event write failed", {
      type: input.type,
      error: (err as Error).message
    });
  }
}

export interface GatherOutcome {
  status: "READY" | "NEEDS_INPUT";
  payload: Record<string, unknown>;
  missing: string[];
  context: Record<string, unknown>;
  reason?: string;
}

/**
 * The gathering phase: validate static slots, run computed-slot resolvers,
 * and build display context. Deterministic; a resolver failure degrades the
 * slot to missing instead of throwing.
 */
export async function gatherPayload(
  db: PrismaClient,
  automation: Automation,
  staticParams: Record<string, unknown>,
  dueAt: Date,
  now: Date
): Promise<GatherOutcome> {
  const ctx: ResolveContext = { db, staticParams, dueAt, now };

  const staticResult = validateSlots(automation, staticParams, ["static"]);
  const payload: Record<string, unknown> = { ...staticResult.values };
  const missing = [...staticResult.missing];

  for (const name of slotNames(automation, "computed")) {
    const spec = automation.params[name];
    try {
      const raw = await spec.resolve!(ctx);
      const parsed = spec.schema.safeParse(raw);
      if (parsed.success) {
        payload[name] = parsed.data;
      } else if (!spec.optional) {
        missing.push(name);
      }
    } catch (err) {
      logger.error("computed slot resolver failed", {
        automationId: automation.id,
        slot: name,
        error: (err as Error).message
      });
      if (!spec.optional) missing.push(name);
    }
  }

  let context: Record<string, unknown> = {};
  if (automation.buildContext) {
    try {
      context = await automation.buildContext(ctx);
    } catch (err) {
      logger.error("automation context builder failed", {
        automationId: automation.id,
        error: (err as Error).message
      });
    }
  }

  return {
    status: missing.length > 0 ? "NEEDS_INPUT" : "READY",
    payload,
    missing,
    context
  };
}

export interface ExecuteFiringResult {
  status: "DONE" | "FAILED" | "NEEDS_INPUT";
  summary: string;
}

/**
 * Execute a firing: re-validate the stored payload (schema drift between fire
 * and confirm degrades to NEEDS_INPUT), validate the supplied ask values
 * (invalid input throws — the firing stays open), run the automation, and
 * resolve the firing with its outcome event.
 */
export async function executeFiring(
  db: PrismaClient,
  firing: TaskFiring,
  askValues: Record<string, unknown>,
  actor: { id: string; name: string }
): Promise<ExecuteFiringResult> {
  const automation = getAutomation(firing.automationId);
  if (!automation) {
    return degradeToNeedsInput(db, firing, `Automatización desconocida: ${firing.automationId}`);
  }

  const stored = JSON.parse(firing.payloadJson) as Record<string, unknown>;
  const storedResult = validateSlots(automation, stored, ["static", "computed"]);
  if (storedResult.missing.length > 0) {
    return degradeToNeedsInput(
      db,
      firing,
      `La automatización cambió desde que se disparó; falta: ${storedResult.missing.join(", ")}.`,
      storedResult.missing
    );
  }

  const askResult = validateSlots(automation, { ...stored, ...askValues }, ["ask"]);
  if (askResult.missing.length > 0) {
    // Founder-supplied values failed — reject the request, firing stays open.
    throw new ValidationError(
      `Valores inválidos o faltantes: ${askResult.missing.join(", ")}` as never
    );
  }

  const payload = { ...storedResult.values, ...askResult.values };
  const deps = {
    db,
    createTransaction: createCreateTransaction(db),
    actorId: actor.id
  };

  try {
    const result = await automation.execute(payload, deps);
    await db.taskFiring.update({
      where: { id: firing.id },
      data: {
        status: "DONE",
        payloadJson: JSON.stringify(payload),
        resolvedAt: new Date(),
        resolvedById: actor.id,
        reason: null
      }
    });
    await recordTaskEvent(db, {
      type: "task.completed",
      actorId: actor.id === "system" ? undefined : actor.id,
      actorName: actor.name,
      amount: result.amount,
      summary: result.summary,
      payload: { ...taskEventPayload(firing), skipped: false, resultSummary: result.summary }
    });
    return { status: "DONE", summary: result.summary };
  } catch (err) {
    const reason = (err as Error).message;
    await db.taskFiring.update({
      where: { id: firing.id },
      data: {
        status: "FAILED",
        resolvedAt: new Date(),
        resolvedById: actor.id,
        reason
      }
    });
    await recordTaskEvent(db, {
      type: "task.failed",
      actorId: actor.id === "system" ? undefined : actor.id,
      actorName: actor.name,
      summary: `La tarea "${firing.taskName}" falló: ${reason}`,
      payload: { ...taskEventPayload(firing), reason }
    });
    return { status: "FAILED", summary: reason };
  }
}

/** Resolve a firing as skipped (no execution) with its task.completed event. */
export async function skipFiring(
  db: PrismaClient,
  firing: TaskFiring,
  actor: { id: string; name: string }
): Promise<void> {
  await db.taskFiring.update({
    where: { id: firing.id },
    data: { status: "SKIPPED", resolvedAt: new Date(), resolvedById: actor.id }
  });
  await recordTaskEvent(db, {
    type: "task.completed",
    actorId: actor.id,
    actorName: actor.name,
    summary: `La tarea "${firing.taskName}" fue omitida.`,
    payload: { ...taskEventPayload(firing), skipped: true }
  });
}

async function degradeToNeedsInput(
  db: PrismaClient,
  firing: TaskFiring,
  reason: string,
  missing: string[] = []
): Promise<ExecuteFiringResult> {
  await db.taskFiring.update({
    where: { id: firing.id },
    data: {
      status: "NEEDS_INPUT",
      missingSlotsJson: JSON.stringify(missing),
      reason
    }
  });
  await recordTaskEvent(db, {
    type: "task.needs_input",
    actorName: "Sistema",
    summary: `La tarea "${firing.taskName}" necesita revisión: ${reason}`,
    payload: {
      ...taskEventPayload(firing),
      missingSlots: missing.length > 0 ? missing : ["(desconocido)"],
      reason
    }
  });
  return { status: "NEEDS_INPUT", summary: reason };
}

export { recordTaskEvent, taskEventPayload };
