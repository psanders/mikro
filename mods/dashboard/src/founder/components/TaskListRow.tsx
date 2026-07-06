/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * One task-definition row in the Tasks tab (Pencil "tareas states" screen
 * `U6iGU`): automation icon chip, name + schedule meta, next-firing text, a
 * pause/resume toggle, and a delete action. Presentational — the screen owns
 * the tRPC calls.
 */
import { BookCheck, Fuel, HandCoins, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

export interface TaskListItem {
  id: string;
  name: string;
  automationId: string;
  automationTitle: string;
  frequency: "once" | "daily" | "weekly" | "monthly";
  weekday: number | null;
  dayOfMonth: number | null;
  onDate: string | null;
  timeOfDay: string;
  enabled: boolean;
  /** ISO timestamp of the next firing; null when disabled or exhausted. */
  nextFireAt: string | null;
  /** Ask-slot labels, shown as "se pregunta al confirmar". */
  askLabels: string[];
}

export interface TaskListRowProps {
  task: TaskListItem;
  onToggle?: (task: TaskListItem, enabled: boolean) => void;
  onEdit?: (task: TaskListItem) => void;
  onDelete?: (task: TaskListItem) => void;
  className?: string;
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

interface AutomationVisual {
  icon: LucideIcon;
  chipBg: string;
  chipFg: string;
}

const AUTOMATION_VISUALS: Record<string, AutomationVisual> = {
  "pay-collector": { icon: HandCoins, chipBg: "bg-[#FDF1E3]", chipFg: "text-[#D97706]" },
  "record-expense": { icon: Fuel, chipBg: "bg-[#FDF1E3]", chipFg: "text-[#D97706]" },
  "daily-close": { icon: BookCheck, chipBg: "bg-[#E8F7EE]", chipFg: "text-[#16A34A]" }
};

const DEFAULT_VISUAL: AutomationVisual = {
  icon: HandCoins,
  chipBg: "bg-[#EEF3F9]",
  chipFg: "text-[#697A93]"
};

/** Spanish schedule descriptor: "semanal, viernes 8:00" etc. */
export function scheduleLabel(task: TaskListItem): string {
  switch (task.frequency) {
    case "daily":
      return `diaria, ${task.timeOfDay}`;
    case "weekly":
      return `semanal, ${WEEKDAYS[task.weekday ?? 0]} ${task.timeOfDay}`;
    case "monthly":
      return `mensual, día ${task.dayOfMonth}, ${task.timeOfDay}`;
    case "once":
      return `una vez, ${task.onDate} ${task.timeOfDay}`;
  }
}

/** Compact next-firing text: "Próxima: vie 10 jul, 8:00" / "Pausada". */
export function nextFiringLabel(task: TaskListItem): string {
  if (!task.enabled) return "Pausada";
  if (!task.nextFireAt) return "Sin próximo disparo";
  const date = new Date(task.nextFireAt);
  const day = date.toLocaleDateString("es-DO", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });
  const time = date.toLocaleTimeString("es-DO", { hour: "numeric", minute: "2-digit" });
  return `Próxima: ${day}, ${time}`;
}

export function TaskListRow({ task, onToggle, onEdit, onDelete, className }: TaskListRowProps) {
  const visual = AUTOMATION_VISUALS[task.automationId] ?? DEFAULT_VISUAL;
  const Icon = visual.icon;
  const askNote =
    task.askLabels.length > 0 ? ` · se pregunta ${task.askLabels.join(", ").toLowerCase()}` : "";

  return (
    <div
      className={cn(
        "flex w-full items-center gap-[14px] border-b border-[#E5EAF1] px-6 py-4",
        className
      )}
    >
      <div
        className={cn(
          "flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[11px]",
          visual.chipBg
        )}
      >
        <Icon size={17} strokeWidth={2} className={visual.chipFg} />
      </div>

      <button
        type="button"
        onClick={() => onEdit?.(task)}
        className="flex min-w-0 flex-1 flex-col gap-[3px] text-left"
      >
        <p className="truncate text-[14px] font-semibold leading-tight text-[#14254A]">
          {task.name}
        </p>
        <p className="truncate text-[12px] font-medium leading-tight text-[#697A93]">
          {task.automationTitle} · {scheduleLabel(task)}
          {askNote}
        </p>
      </button>

      <span className="shrink-0 text-[12px] font-medium text-[#697A93]">
        {nextFiringLabel(task)}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={task.enabled}
        aria-label={task.enabled ? "Pausar tarea" : "Reanudar tarea"}
        onClick={() => onToggle?.(task, !task.enabled)}
        className={cn(
          "relative h-[20px] w-[36px] shrink-0 rounded-full transition",
          task.enabled ? "bg-[#1F4AA8]" : "bg-[#E5EAF1]"
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white transition-all",
            task.enabled ? "left-[18px]" : "left-[2px]"
          )}
        />
      </button>

      <button
        type="button"
        aria-label="Eliminar tarea"
        onClick={() => onDelete?.(task)}
        className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[9px] text-[#697A93] transition hover:bg-[#FCEBEB] hover:text-[#DC2626]"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
