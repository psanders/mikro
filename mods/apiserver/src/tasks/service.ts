/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Founder-task CRUD and firing resolution, shared by the tRPC router and the
 * copilot DIRECT tools (one validation path for both — full parity). Every
 * function validates against the `@mikro/common` contract plus the catalog
 * (automation exists, gate respects its floor, static slots satisfy their
 * schemas) and throws the repo's structured `ValidationError` on failure.
 */
import {
  ValidationError,
  cancelTaskSchema,
  confirmTaskFiringSchema,
  createTaskSchema,
  getTaskFiringSchema,
  listTasksSchema,
  setTaskEnabledSchema,
  skipTaskFiringSchema,
  updateTaskSchema,
  type TaskFiringView,
  type TaskView
} from "@mikro/common";
import type { PrismaClient, Task, TaskFiring } from "../generated/prisma/client.js";
import { getAutomation, gateRespectsFloor } from "./catalog.js";
import { computeNextFireAt, type ScheduleFields } from "./dates.js";
import { validateSlots } from "./validatePayload.js";
import {
  OPEN_FIRING_STATUSES,
  executeFiring,
  skipFiring,
  type ExecuteFiringResult
} from "./firings.js";

function scheduleOf(task: Task): ScheduleFields {
  return {
    frequency: task.frequency as ScheduleFields["frequency"],
    weekday: task.weekday,
    dayOfMonth: task.dayOfMonth,
    onDate: task.onDate,
    timeOfDay: task.timeOfDay
  };
}

function toTaskView(task: Task): TaskView {
  return {
    id: task.id,
    name: task.name,
    automationId: task.automationId,
    frequency: task.frequency as TaskView["frequency"],
    weekday: task.weekday,
    dayOfMonth: task.dayOfMonth,
    onDate: task.onDate,
    timeOfDay: task.timeOfDay,
    staticParams: JSON.parse(task.staticParamsJson) as Record<string, unknown>,
    gate: task.gate as TaskView["gate"],
    enabled: task.enabled,
    nextFireAt: task.nextFireAt,
    createdAt: task.createdAt
  };
}

function toFiringView(firing: TaskFiring): TaskFiringView {
  const automation = getAutomation(firing.automationId);
  const payload = JSON.parse(firing.payloadJson) as Record<string, unknown>;
  const missing = firing.missingSlotsJson ? (JSON.parse(firing.missingSlotsJson) as string[]) : [];

  // Slots the founder can still supply on the card: every ask slot plus any
  // missing slot the automation knows about (a failed resolver's slot is
  // founder-suppliable at confirm).
  const askSlots = automation
    ? Object.entries(automation.params)
        .filter(([name, spec]) => spec.source === "ask" || missing.includes(name))
        .map(([name, spec]) => ({
          name,
          label: spec.label,
          source: spec.source,
          kind: spec.kind,
          optional: spec.optional ?? false
        }))
    : [];

  return {
    id: firing.id,
    taskId: firing.taskId,
    automationId: firing.automationId,
    taskName: firing.taskName,
    status: firing.status as TaskFiringView["status"],
    payload,
    missingSlots: missing,
    askSlots,
    context: firing.contextJson ? (JSON.parse(firing.contextJson) as Record<string, unknown>) : {},
    reason: firing.reason,
    dueAt: firing.dueAt,
    resolvedAt: firing.resolvedAt
  };
}

/** Validate automation + gate + static slots for a create/update. */
function checkAgainstCatalog(
  automationId: string,
  gate: string | undefined,
  staticParams: Record<string, unknown>
): { gate: string; staticParams: Record<string, unknown> } {
  const automation = getAutomation(automationId);
  if (!automation) {
    throw new Error(`Automatización desconocida: ${automationId}`);
  }

  const effectiveGate = gate ?? automation.gateFloor;
  if (!gateRespectsFloor(effectiveGate as "auto" | "confirm", automation.gateFloor)) {
    throw new Error(
      `La automatización "${automation.title}" requiere confirmación; el gate no puede ser "auto".`
    );
  }

  const result = validateSlots(automation, staticParams, ["static"]);
  if (result.missing.length > 0) {
    throw new Error(`Parámetros inválidos o faltantes: ${result.missing.join(", ")}.`);
  }

  return { gate: effectiveGate, staticParams: result.values };
}

export async function createTask(
  db: PrismaClient,
  rawInput: unknown,
  createdById: string
): Promise<TaskView> {
  const parsed = createTaskSchema.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError(parsed.error);
  const input = parsed.data;

  const checked = checkAgainstCatalog(input.automationId, input.gate, input.staticParams);

  const schedule: ScheduleFields = {
    frequency: input.frequency,
    weekday: input.weekday ?? null,
    dayOfMonth: input.dayOfMonth ?? null,
    onDate: input.onDate ?? null,
    timeOfDay: input.timeOfDay
  };
  const nextFireAt = computeNextFireAt(schedule, new Date());
  if (nextFireAt === null) {
    throw new Error("La fecha de la tarea ya pasó; nada que programar.");
  }

  const task = await db.task.create({
    data: {
      name: input.name,
      automationId: input.automationId,
      frequency: input.frequency,
      weekday: input.weekday ?? null,
      dayOfMonth: input.dayOfMonth ?? null,
      onDate: input.onDate ?? null,
      timeOfDay: input.timeOfDay,
      staticParamsJson: JSON.stringify(checked.staticParams),
      gate: checked.gate,
      nextFireAt,
      createdById
    }
  });

  return toTaskView(task);
}

export async function listTasks(db: PrismaClient, rawInput: unknown): Promise<TaskView[]> {
  const parsed = listTasksSchema.safeParse(rawInput ?? {});
  if (!parsed.success) throw new ValidationError(parsed.error);

  const tasks = await db.task.findMany({
    where: parsed.data.includeDisabled ? {} : { enabled: true },
    orderBy: { createdAt: "desc" }
  });
  return tasks.map(toTaskView);
}

export async function updateTask(db: PrismaClient, rawInput: unknown): Promise<TaskView> {
  const parsed = updateTaskSchema.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError(parsed.error);
  const input = parsed.data;

  const existing = await db.task.findUnique({ where: { id: input.id } });
  if (!existing) throw new Error("Tarea no encontrada.");

  const staticParams =
    input.staticParams ?? (JSON.parse(existing.staticParamsJson) as Record<string, unknown>);
  const checked = checkAgainstCatalog(
    existing.automationId,
    input.gate ?? existing.gate,
    staticParams
  );

  const schedule: ScheduleFields = {
    frequency: (input.frequency ?? existing.frequency) as ScheduleFields["frequency"],
    weekday: input.frequency !== undefined ? (input.weekday ?? null) : existing.weekday,
    dayOfMonth: input.frequency !== undefined ? (input.dayOfMonth ?? null) : existing.dayOfMonth,
    onDate: input.frequency !== undefined ? (input.onDate ?? null) : existing.onDate,
    timeOfDay: input.timeOfDay ?? existing.timeOfDay
  };
  const scheduleChanged = input.frequency !== undefined || input.timeOfDay !== undefined;

  const task = await db.task.update({
    where: { id: input.id },
    data: {
      name: input.name ?? existing.name,
      frequency: schedule.frequency,
      weekday: schedule.weekday,
      dayOfMonth: schedule.dayOfMonth,
      onDate: schedule.onDate,
      timeOfDay: schedule.timeOfDay,
      staticParamsJson: JSON.stringify(checked.staticParams),
      gate: checked.gate,
      ...(scheduleChanged && existing.enabled
        ? { nextFireAt: computeNextFireAt(schedule, new Date()) }
        : {})
    }
  });

  return toTaskView(task);
}

/**
 * Pause or resume. Resuming recomputes nextFireAt forward — paused periods
 * are never fired retroactively.
 */
export async function setTaskEnabled(db: PrismaClient, rawInput: unknown): Promise<TaskView> {
  const parsed = setTaskEnabledSchema.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError(parsed.error);

  const existing = await db.task.findUnique({ where: { id: parsed.data.id } });
  if (!existing) throw new Error("Tarea no encontrada.");

  const task = await db.task.update({
    where: { id: parsed.data.id },
    data: {
      enabled: parsed.data.enabled,
      ...(parsed.data.enabled
        ? { nextFireAt: computeNextFireAt(scheduleOf(existing), new Date()) }
        : {})
    }
  });
  return toTaskView(task);
}

/** Delete the definition. An open firing survives (taskId set null) and stays resolvable. */
export async function cancelTask(db: PrismaClient, rawInput: unknown): Promise<{ id: string }> {
  const parsed = cancelTaskSchema.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError(parsed.error);

  const existing = await db.task.findUnique({ where: { id: parsed.data.id } });
  if (!existing) throw new Error("Tarea no encontrada.");

  await db.task.delete({ where: { id: parsed.data.id } });
  return { id: parsed.data.id };
}

export async function getTaskFiring(db: PrismaClient, rawInput: unknown): Promise<TaskFiringView> {
  const parsed = getTaskFiringSchema.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError(parsed.error);

  const firing = await db.taskFiring.findUnique({ where: { id: parsed.data.id } });
  if (!firing) throw new Error("Tarea (ocurrencia) no encontrada.");
  return toFiringView(firing);
}

async function loadOpenFiring(db: PrismaClient, id: string): Promise<TaskFiring> {
  const firing = await db.taskFiring.findUnique({ where: { id } });
  if (!firing) throw new Error("Tarea (ocurrencia) no encontrada.");
  if (!(OPEN_FIRING_STATUSES as readonly string[]).includes(firing.status)) {
    throw new Error("Esta tarea ya fue resuelta.");
  }
  return firing;
}

export async function confirmTaskFiring(
  db: PrismaClient,
  rawInput: unknown,
  actor: { id: string; name: string }
): Promise<ExecuteFiringResult & { firing: TaskFiringView }> {
  const parsed = confirmTaskFiringSchema.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError(parsed.error);

  const firing = await loadOpenFiring(db, parsed.data.id);
  const result = await executeFiring(db, firing, parsed.data.askValues, actor);
  const updated = await db.taskFiring.findUniqueOrThrow({ where: { id: firing.id } });
  return { ...result, firing: toFiringView(updated) };
}

export async function skipTaskFiring(
  db: PrismaClient,
  rawInput: unknown,
  actor: { id: string; name: string }
): Promise<TaskFiringView> {
  const parsed = skipTaskFiringSchema.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError(parsed.error);

  const firing = await loadOpenFiring(db, parsed.data.id);
  await skipFiring(db, firing, actor);
  const updated = await db.taskFiring.findUniqueOrThrow({ where: { id: firing.id } });
  return toFiringView(updated);
}
