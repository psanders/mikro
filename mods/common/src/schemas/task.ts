/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Founder Tasks contracts: a Task binds a catalog automation to a recurrence
 * schedule; a TaskFiring is one occurrence moving through
 * NEEDS_INPUT | READY → DONE | SKIPPED | FAILED. Schedules are structured
 * fields (not cron) interpreted in America/Santo_Domingo.
 */
import { z } from "zod/v4";

export const TASK_TIMEZONE = "America/Santo_Domingo";

/** Fixed offset for America/Santo_Domingo (no DST). */
export const TASK_UTC_OFFSET_HOURS = -4;

export const taskFrequencyEnum = z.enum(["once", "daily", "weekly", "monthly"]);
export type TaskFrequency = z.infer<typeof taskFrequencyEnum>;

export const taskGateEnum = z.enum(["auto", "confirm"]);
export type TaskGate = z.infer<typeof taskGateEnum>;

export const taskFiringStatusEnum = z.enum(["NEEDS_INPUT", "READY", "DONE", "SKIPPED", "FAILED"]);
export type TaskFiringStatus = z.infer<typeof taskFiringStatusEnum>;

/** How a slot's value is produced. */
export const taskSlotSourceEnum = z.enum(["static", "computed", "ask"]);
export type TaskSlotSource = z.infer<typeof taskSlotSourceEnum>;

const timeOfDaySchema = z
  .string()
  .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "timeOfDay debe ser HH:MM (24h)");

const scheduleFields = {
  frequency: taskFrequencyEnum,
  /** 0 = Sunday … 6 = Saturday. Required for weekly. */
  weekday: z.number().int().min(0).max(6).optional(),
  /** 1–31, clamped to the month's last day. Required for monthly. */
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  /** YYYY-MM-DD in America/Santo_Domingo. Required for once. */
  onDate: z.iso.date().optional(),
  /** HH:MM (24h) in America/Santo_Domingo. */
  timeOfDay: timeOfDaySchema
};

function requireScheduleFields(
  data: { frequency: TaskFrequency; weekday?: number; dayOfMonth?: number; onDate?: string },
  ctx: z.RefinementCtx
) {
  if (data.frequency === "weekly" && data.weekday === undefined) {
    ctx.addIssue({ code: "custom", path: ["weekday"], message: "weekly requiere weekday" });
  }
  if (data.frequency === "monthly" && data.dayOfMonth === undefined) {
    ctx.addIssue({ code: "custom", path: ["dayOfMonth"], message: "monthly requiere dayOfMonth" });
  }
  if (data.frequency === "once" && data.onDate === undefined) {
    ctx.addIssue({ code: "custom", path: ["onDate"], message: "once requiere onDate" });
  }
}

export const createTaskSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    automationId: z.string().min(1),
    ...scheduleFields,
    /** Values for the automation's static slots, validated against the catalog. */
    staticParams: z.record(z.string(), z.unknown()).default({}),
    /** Omitted = the automation's gate floor. May tighten, never loosen. */
    gate: taskGateEnum.optional()
  })
  .superRefine(requireScheduleFields);

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(120).optional(),
    frequency: taskFrequencyEnum.optional(),
    weekday: z.number().int().min(0).max(6).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    onDate: z.iso.date().optional(),
    timeOfDay: timeOfDaySchema.optional(),
    staticParams: z.record(z.string(), z.unknown()).optional(),
    gate: taskGateEnum.optional()
  })
  .superRefine((data, ctx) => {
    if (data.frequency !== undefined) {
      requireScheduleFields(
        data as {
          frequency: TaskFrequency;
          weekday?: number;
          dayOfMonth?: number;
          onDate?: string;
        },
        ctx
      );
    }
  });

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const setTaskEnabledSchema = z.object({
  id: z.uuid(),
  enabled: z.boolean()
});

export const cancelTaskSchema = z.object({
  id: z.uuid()
});

export const listTasksSchema = z.object({
  includeDisabled: z.boolean().optional()
});

export const getTaskFiringSchema = z.object({
  id: z.uuid()
});

export const confirmTaskFiringSchema = z.object({
  id: z.uuid(),
  /** Values for the automation's ask slots, validated against the catalog. */
  askValues: z.record(z.string(), z.unknown()).default({})
});

export const skipTaskFiringSchema = z.object({
  id: z.uuid()
});

/**
 * A catalog slot as described to clients (the Tasks tab renders its create
 * form from these; the copilot tool documents them). `kind` is a coarse input
 * hint, not the validation source of truth — the server always re-validates
 * against the automation's Zod schema.
 */
export interface TaskSlotDescriptor {
  name: string;
  label: string;
  source: TaskSlotSource;
  kind: "text" | "amount" | "collector" | "account" | "category";
  optional: boolean;
}

/** A catalog automation as described to clients. */
export interface TaskAutomationDescriptor {
  id: string;
  title: string;
  gateFloor: TaskGate;
  slots: TaskSlotDescriptor[];
}

/** A task definition as returned to the client / copilot. */
export interface TaskView {
  id: string;
  name: string;
  automationId: string;
  frequency: TaskFrequency;
  weekday: number | null;
  dayOfMonth: number | null;
  onDate: string | null;
  timeOfDay: string;
  staticParams: Record<string, unknown>;
  gate: TaskGate;
  enabled: boolean;
  nextFireAt: Date | null;
  createdAt: Date;
}

/** A firing as returned to the feed card widget. */
export interface TaskFiringView {
  id: string;
  taskId: string | null;
  automationId: string;
  taskName: string;
  status: TaskFiringStatus;
  payload: Record<string, unknown>;
  missingSlots: string[];
  /** Ask slots still pending founder input (from the automation's descriptor). */
  askSlots: TaskSlotDescriptor[];
  /** Display-only context computed at fire time (e.g. week's collected total). */
  context: Record<string, unknown>;
  reason: string | null;
  dueAt: Date;
  resolvedAt: Date | null;
}
