/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * One pass of the task worker (design D4), pure so it can be unit-tested
 * without a timer. For each enabled task with nextFireAt <= now: create one
 * firing (unless one is still open AND the automation doesn't opt into
 * `stackFirings` — missed periods then collapse into a single late firing
 * instead of stacking), run the gathering phase, emit the lifecycle event,
 * execute immediately when the gate is auto, and advance the schedule. A
 * failure on one task never blocks the others.
 */
import type { PrismaClient } from "../generated/prisma/client.js";
import { logger } from "../logger.js";
import { getAutomation } from "./catalog.js";
import { computeNextFireAt, type ScheduleFields } from "./dates.js";
import { OPEN_FIRING_STATUSES, executeFiring, gatherPayload, recordTaskEvent } from "./firings.js";

export interface ProcessDueTasksResult {
  fired: number;
  executed: number;
  needsInput: number;
}

export async function processDueTasks(
  db: PrismaClient,
  now: Date = new Date()
): Promise<ProcessDueTasksResult> {
  const due = await db.task.findMany({
    where: { enabled: true, nextFireAt: { not: null, lte: now } }
  });

  const result: ProcessDueTasksResult = { fired: 0, executed: 0, needsInput: 0 };

  for (const task of due) {
    try {
      const schedule: ScheduleFields = {
        frequency: task.frequency as ScheduleFields["frequency"],
        weekday: task.weekday,
        dayOfMonth: task.dayOfMonth,
        onDate: task.onDate,
        timeOfDay: task.timeOfDay
      };
      const advance =
        task.frequency === "once"
          ? { nextFireAt: null, enabled: false }
          : { nextFireAt: computeNextFireAt(schedule, now) };

      const automation = getAutomation(task.automationId);

      if (!automation?.stackFirings) {
        const open = await db.taskFiring.count({
          where: { taskId: task.id, status: { in: [...OPEN_FIRING_STATUSES] } }
        });
        if (open > 0) {
          // Never stack firings for fungible obligations: the open card
          // already represents it; the schedule still advances past the
          // missed period. Automations that opt into `stackFirings` (each
          // firing bound to a distinct unit of work) skip this collapse —
          // see the Automation.stackFirings doc comment.
          await db.task.update({ where: { id: task.id }, data: advance });
          continue;
        }
      }

      const dueAt = task.nextFireAt as Date;
      const staticParams = JSON.parse(task.staticParamsJson) as Record<string, unknown>;

      const gathered = automation
        ? await gatherPayload(db, automation, staticParams, dueAt, now)
        : {
            status: "NEEDS_INPUT" as const,
            payload: {},
            missing: ["(automatización desconocida)"],
            context: {},
            reason: `Automatización desconocida: ${task.automationId}`
          };

      const firing = await db.taskFiring.create({
        data: {
          taskId: task.id,
          automationId: task.automationId,
          taskName: task.name,
          gate: task.gate,
          status: gathered.status,
          payloadJson: JSON.stringify(gathered.payload),
          missingSlotsJson: JSON.stringify(gathered.missing),
          contextJson: JSON.stringify(gathered.context),
          reason: gathered.reason ?? null,
          dueAt
        }
      });
      result.fired += 1;

      if (gathered.status === "NEEDS_INPUT") {
        result.needsInput += 1;
        await recordTaskEvent(db, {
          type: "task.needs_input",
          actorName: "Sistema",
          summary: `La tarea "${task.name}" necesita información: ${gathered.missing.join(", ")}.`,
          payload: {
            taskFiringId: firing.id,
            automationId: task.automationId,
            taskName: task.name,
            missingSlots: gathered.missing,
            reason: gathered.reason
          }
        });
      } else if (task.gate === "confirm") {
        await recordTaskEvent(db, {
          type: "task.due",
          actorName: "Sistema",
          summary: `La tarea "${task.name}" está lista para confirmar.`,
          payload: {
            taskFiringId: firing.id,
            automationId: task.automationId,
            taskName: task.name,
            dueAt: dueAt.toISOString()
          }
        });
      } else {
        // Auto gate: execute in place, attributed to the task's creator.
        await recordTaskEvent(db, {
          type: "task.due",
          actorName: "Sistema",
          summary: `La tarea "${task.name}" se disparó (ejecución automática).`,
          payload: {
            taskFiringId: firing.id,
            automationId: task.automationId,
            taskName: task.name,
            dueAt: dueAt.toISOString()
          }
        });
        await executeFiring(db, firing, {}, { id: task.createdById, name: "Sistema" });
        result.executed += 1;
      }

      await db.task.update({ where: { id: task.id }, data: advance });
    } catch (err) {
      logger.error("task worker: task processing failed", {
        taskId: task.id,
        error: (err as Error).message
      });
    }
  }

  return result;
}
