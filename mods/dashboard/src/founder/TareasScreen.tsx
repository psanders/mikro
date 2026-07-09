/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Founder Tasks tab (`/founder/tareas`) — Pencil "tareas states" screen
 * `U6iGU`. Lists task definitions with pause/resume and delete, and opens the
 * schema-driven create/edit modal (`TaskFormModal`). Creation here has full
 * parity with copilot creation: both call tasks.create with the same
 * validation (catalog automation, gate floor, static-slot schemas).
 */
import { useMemo, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { trpc, type RouterOutputs } from "../lib/trpc";
import { useToast } from "../components/ui/ToastProvider";
import { useCopilot } from "./copilot/CopilotContext";
import { TaskListRow, type TaskListItem } from "./components/TaskListRow";
import {
  TaskFormModal,
  type TaskAutomationOption,
  type TaskFormValues
} from "./components/TaskFormModal";

type TaskView = RouterOutputs["tasks"]["list"][number];
type AutomationDescriptor = RouterOutputs["tasks"]["listAutomations"][number];

function toListItem(task: TaskView, automations: AutomationDescriptor[]): TaskListItem {
  const automation = automations.find((a) => a.id === task.automationId);
  return {
    id: task.id,
    name: task.name,
    automationId: task.automationId,
    automationTitle: automation?.title ?? task.automationId,
    frequency: task.frequency,
    weekday: task.weekday,
    dayOfMonth: task.dayOfMonth,
    onDate: task.onDate,
    timeOfDay: task.timeOfDay,
    enabled: task.enabled,
    nextFireAt: task.nextFireAt ? new Date(task.nextFireAt).toISOString() : null,
    askLabels: (automation?.slots ?? []).filter((s) => s.source === "ask").map((s) => s.label)
  };
}

export function TareasScreen() {
  const toast = useToast();
  const utils = trpc.useUtils();
  const copilot = useCopilot();

  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; task: TaskView } | null>(
    null
  );
  const [formError, setFormError] = useState<string | null>(null);

  const tasksQuery = trpc.tasks.list.useQuery({ includeDisabled: true });
  const automationsQuery = trpc.tasks.listAutomations.useQuery();
  const usersQuery = trpc.listUsers.useQuery({ limit: 100 });
  const accountsQuery = trpc.accounting.listAccounts.useQuery({});
  const categoriesQuery = trpc.accounting.listCategories.useQuery({});

  const invalidate = () => void utils.tasks.list.invalidate();

  const create = trpc.tasks.create.useMutation({
    onSuccess: () => {
      toast.success("Tarea creada.");
      setModal(null);
      setFormError(null);
      invalidate();
    },
    onError: (err) => setFormError(err.message || "No se pudo crear la tarea.")
  });

  const update = trpc.tasks.update.useMutation({
    onSuccess: () => {
      toast.success("Tarea actualizada.");
      setModal(null);
      setFormError(null);
      invalidate();
    },
    onError: (err) => setFormError(err.message || "No se pudo actualizar la tarea.")
  });

  const setEnabled = trpc.tasks.setEnabled.useMutation({
    onSuccess: (task) => {
      toast.success(task.enabled ? "Tarea reanudada." : "Tarea pausada.");
      invalidate();
    },
    onError: (err) => toast.error(err.message || "No se pudo actualizar la tarea.")
  });

  const cancel = trpc.tasks.cancel.useMutation({
    onSuccess: () => {
      toast.success("Tarea eliminada.");
      invalidate();
    },
    onError: (err) => toast.error(err.message || "No se pudo eliminar la tarea.")
  });

  const automations: TaskAutomationOption[] = automationsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const items = useMemo(
    () => tasks.map((t) => toListItem(t, automationsQuery.data ?? [])),
    [tasks, automationsQuery.data]
  );
  const activeCount = tasks.filter((t) => t.enabled).length;

  function handleSubmit(values: TaskFormValues) {
    if (modal?.mode === "edit") {
      update.mutate({
        id: modal.task.id,
        name: values.name,
        frequency: values.frequency,
        weekday: values.weekday,
        dayOfMonth: values.dayOfMonth,
        onDate: values.onDate,
        timeOfDay: values.timeOfDay,
        staticParams: values.staticParams
      });
    } else {
      create.mutate({
        name: values.name,
        automationId: values.automationId,
        frequency: values.frequency,
        weekday: values.weekday,
        dayOfMonth: values.dayOfMonth,
        onDate: values.onDate,
        timeOfDay: values.timeOfDay,
        staticParams: values.staticParams
      });
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-[#E5EAF1] px-6 py-[15px]">
        <div className="flex items-center gap-3">
          <h1 className="text-[19px] font-semibold tracking-[-0.3px] text-[#14254A]">Tareas</h1>
          {tasksQuery.isSuccess && (
            <span className="text-[13px] font-medium text-[#697A93]">
              {activeCount} activa{activeCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-[10px]">
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setModal({ mode: "create" });
            }}
            className="inline-flex items-center gap-[7px] rounded-[9px] bg-[#1F4AA8] px-4 py-[9px] text-[14px] font-medium text-white transition hover:bg-[#1A3F8F]"
          >
            <Plus size={16} />
            Nueva tarea
          </button>
          <button
            type="button"
            onClick={() => copilot.openWith()}
            title="Copiloto"
            aria-label="Copiloto"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#E9F2FF] text-[#1F4AA8] transition hover:bg-[#dbe8fb]"
          >
            <Sparkles size={17} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tasksQuery.isPending && (
          <div className="px-6 py-4 text-sm font-medium text-[#697A93]">Cargando…</div>
        )}

        {tasksQuery.isError && (
          <div className="px-6 py-4 text-sm font-medium text-[#DC2626]">
            No se pudieron cargar las tareas.
          </div>
        )}

        {tasksQuery.isSuccess && items.length === 0 && (
          <div className="flex flex-col items-start gap-2 px-6 py-8">
            <p className="text-[14px] font-semibold text-[#14254A]">Sin tareas programadas</p>
            <p className="text-[13px] font-medium text-[#697A93]">
              Crea una con “Nueva tarea” o pídesela al copiloto: “recuérdame cada viernes pagar al
              cobrador”.
            </p>
          </div>
        )}

        {items.map((item) => (
          <TaskListRow
            key={item.id}
            task={item}
            onToggle={(t, enabled) => setEnabled.mutate({ id: t.id, enabled })}
            onEdit={(t) => {
              const task = tasks.find((x) => x.id === t.id);
              if (task) {
                setFormError(null);
                setModal({ mode: "edit", task });
              }
            }}
            onDelete={(t) => cancel.mutate({ id: t.id })}
          />
        ))}
      </div>

      {modal && (
        <TaskFormModal
          automations={automations}
          employees={(usersQuery.data ?? []).map((u) => ({ id: u.id, name: u.name }))}
          accounts={(accountsQuery.data ?? []).map((a) => ({ id: a.id, name: a.name }))}
          categories={(categoriesQuery.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
          mode={modal.mode}
          initial={
            modal.mode === "edit"
              ? {
                  name: modal.task.name,
                  automationId: modal.task.automationId,
                  frequency: modal.task.frequency,
                  weekday: modal.task.weekday ?? undefined,
                  dayOfMonth: modal.task.dayOfMonth ?? undefined,
                  onDate: modal.task.onDate ?? undefined,
                  timeOfDay: modal.task.timeOfDay,
                  staticParams: Object.fromEntries(
                    Object.entries(modal.task.staticParams ?? {}).map(([k, v]) => [k, String(v)])
                  )
                }
              : undefined
          }
          submitting={create.isPending || update.isPending}
          error={formError}
          onSubmit={handleSubmit}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
