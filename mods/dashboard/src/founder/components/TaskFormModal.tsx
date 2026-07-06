/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The Nueva tarea / Editar tarea modal (Pencil screen `aMH1d`), generated
 * from the selected automation's descriptor: static slots become inputs
 * (selects for collector/account/category), ask slots are previewed as
 * asked-at-confirmation, and the gate is clamped to the automation's floor
 * (v1 automations are all confirm-floor, so it renders as a fixed note).
 * Presentational — options and submission are the screen's job. Full parity
 * with copilot creation: both paths hit the same tasks.create validation.
 */
import { useMemo, useState } from "react";
import { Check, ChevronDown, Info, X } from "lucide-react";
import { cn } from "../../lib/cn";

export interface TaskAutomationOption {
  id: string;
  title: string;
  gateFloor: "auto" | "confirm";
  slots: Array<{
    name: string;
    label: string;
    source: "static" | "computed" | "ask";
    kind: "text" | "amount" | "collector" | "account" | "category";
    optional: boolean;
  }>;
}

export interface SelectOption {
  id: string;
  name: string;
}

export interface TaskFormValues {
  name: string;
  automationId: string;
  frequency: "once" | "daily" | "weekly" | "monthly";
  weekday?: number;
  dayOfMonth?: number;
  onDate?: string;
  timeOfDay: string;
  staticParams: Record<string, string>;
}

export interface TaskFormModalProps {
  automations: TaskAutomationOption[];
  /** Options per slot kind, provided by the screen. */
  collectors: SelectOption[];
  accounts: SelectOption[];
  categories: SelectOption[];
  /** Prefill for edit; the automation select is locked in edit mode. */
  initial?: Partial<TaskFormValues>;
  mode?: "create" | "edit";
  submitting?: boolean;
  error?: string | null;
  onSubmit?: (values: TaskFormValues) => void;
  onClose?: () => void;
}

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" }
];

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Semanal" },
  { value: "daily", label: "Diaria" },
  { value: "monthly", label: "Mensual" },
  { value: "once", label: "Una vez" }
] as const;

const FIELD_LABEL = "text-[13px] font-medium text-[#14254A]";
const FIELD_INPUT =
  "w-full rounded-[8px] border border-[#E5EAF1] bg-white px-[14px] py-[10px] text-[14px] font-medium text-[#14254A] focus:border-[#1F4AA8] focus:outline-none";
const FIELD_SELECT = cn(FIELD_INPUT, "appearance-none pr-[36px]");
const SELECT_CHEVRON =
  "pointer-events-none absolute right-[14px] top-1/2 -translate-y-1/2 text-[#697A93]";

export function TaskFormModal({
  automations,
  collectors,
  accounts,
  categories,
  initial,
  mode = "create",
  submitting = false,
  error,
  onSubmit,
  onClose
}: TaskFormModalProps) {
  const [automationId, setAutomationId] = useState(
    initial?.automationId ?? automations[0]?.id ?? ""
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [frequency, setFrequency] = useState<TaskFormValues["frequency"]>(
    initial?.frequency ?? "weekly"
  );
  const [weekday, setWeekday] = useState<number>(initial?.weekday ?? 5);
  const [dayOfMonth, setDayOfMonth] = useState<number>(initial?.dayOfMonth ?? 1);
  const [onDate, setOnDate] = useState(initial?.onDate ?? "");
  const [timeOfDay, setTimeOfDay] = useState(initial?.timeOfDay ?? "08:00");
  const [staticParams, setStaticParams] = useState<Record<string, string>>(
    initial?.staticParams ?? {}
  );

  const automation = useMemo(
    () => automations.find((a) => a.id === automationId),
    [automations, automationId]
  );
  const staticSlots = automation?.slots.filter((s) => s.source === "static") ?? [];
  const askSlots = automation?.slots.filter((s) => s.source === "ask") ?? [];

  function optionsFor(kind: string): SelectOption[] | null {
    if (kind === "collector") return collectors;
    if (kind === "account") return accounts;
    if (kind === "category") return categories;
    return null;
  }

  function setParam(slotName: string, value: string) {
    setStaticParams((prev) => ({ ...prev, [slotName]: value }));
  }

  function handleSubmit() {
    onSubmit?.({
      name,
      automationId,
      frequency,
      weekday: frequency === "weekly" ? weekday : undefined,
      dayOfMonth: frequency === "monthly" ? dayOfMonth : undefined,
      onDate: frequency === "once" ? onDate : undefined,
      timeOfDay,
      staticParams
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#14254A66] p-6">
      <div className="flex max-h-full w-[520px] flex-col gap-4 overflow-y-auto rounded-[16px] bg-white p-7 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold tracking-[-0.2px] text-[#14254A]">
            {mode === "edit" ? "Editar tarea" : "Nueva tarea"}
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="text-[#697A93] transition hover:text-[#14254A]"
          >
            <X size={18} />
          </button>
        </div>

        <label className="flex flex-col gap-[7px]">
          <span className={FIELD_LABEL}>Automatización</span>
          <div className="relative">
            <select
              value={automationId}
              disabled={mode === "edit"}
              onChange={(e) => {
                setAutomationId(e.target.value);
                setStaticParams({});
              }}
              className={cn(FIELD_SELECT, mode === "edit" && "opacity-60")}
            >
              {automations.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className={cn(SELECT_CHEVRON, mode === "edit" && "opacity-60")}
            />
          </div>
        </label>

        <label className="flex flex-col gap-[7px]">
          <span className={FIELD_LABEL}>Nombre</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pago semanal — Luis M."
            className={FIELD_INPUT}
          />
        </label>

        <div className="flex gap-[10px]">
          <label className="flex flex-1 flex-col gap-[7px]">
            <span className={FIELD_LABEL}>Frecuencia</span>
            <div className="relative">
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as TaskFormValues["frequency"])}
                className={FIELD_SELECT}
              >
                {FREQUENCY_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className={SELECT_CHEVRON} />
            </div>
          </label>

          {frequency === "weekly" && (
            <label className="flex flex-1 flex-col gap-[7px]">
              <span className={FIELD_LABEL}>Día</span>
              <div className="relative">
                <select
                  value={weekday}
                  onChange={(e) => setWeekday(Number(e.target.value))}
                  className={FIELD_SELECT}
                >
                  {WEEKDAY_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className={SELECT_CHEVRON} />
              </div>
            </label>
          )}

          {frequency === "monthly" && (
            <label className="flex flex-1 flex-col gap-[7px]">
              <span className={FIELD_LABEL}>Día del mes</span>
              <input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                className={FIELD_INPUT}
              />
            </label>
          )}

          {frequency === "once" && (
            <label className="flex flex-1 flex-col gap-[7px]">
              <span className={FIELD_LABEL}>Fecha</span>
              <input
                type="date"
                value={onDate}
                onChange={(e) => setOnDate(e.target.value)}
                className={FIELD_INPUT}
              />
            </label>
          )}

          <label className="flex w-[130px] flex-col gap-[7px]">
            <span className={FIELD_LABEL}>Hora</span>
            <input
              type="time"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
              className={FIELD_INPUT}
            />
          </label>
        </div>

        {staticSlots.length > 0 && (
          <>
            <p className="text-[11px] font-semibold tracking-[0.8px] text-[#697A93]">PARÁMETROS</p>
            {staticSlots.map((slot) => {
              const options = optionsFor(slot.kind);
              return (
                <label key={slot.name} className="flex flex-col gap-[7px]">
                  <span className={FIELD_LABEL}>{slot.label}</span>
                  {options ? (
                    <div className="relative">
                      <select
                        value={staticParams[slot.name] ?? ""}
                        onChange={(e) => setParam(slot.name, e.target.value)}
                        className={FIELD_SELECT}
                      >
                        <option value="" disabled>
                          Selecciona…
                        </option>
                        {options.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className={SELECT_CHEVRON} />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={staticParams[slot.name] ?? ""}
                      onChange={(e) => setParam(slot.name, e.target.value)}
                      className={FIELD_INPUT}
                    />
                  )}
                </label>
              );
            })}
          </>
        )}

        {(askSlots.length > 0 || automation?.gateFloor === "confirm") && (
          <div className="flex items-center gap-[8px] rounded-[10px] bg-[#FDF1E3] px-[14px] py-[10px]">
            <Info size={15} className="shrink-0 text-[#D97706]" />
            <p className="text-[12px] font-medium leading-tight text-[#D97706]">
              {askSlots.length > 0
                ? `${askSlots.map((s) => s.label).join(" y ")} se preguntará al confirmar`
                : "Se ejecuta solo con tu confirmación"}
              {askSlots.length > 0 && automation?.gateFloor === "confirm"
                ? " · requiere confirmación"
                : ""}
            </p>
          </div>
        )}

        {error && <p className="text-[12px] font-semibold leading-tight text-[#DC2626]">{error}</p>}

        <div className="flex items-center justify-end gap-[10px]">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-[9px] border border-[#E5EAF1] bg-white px-[16px] py-[9px] text-[14px] font-medium text-[#14254A] transition hover:bg-[#F4F7FB]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className={cn(
              "inline-flex items-center gap-[7px] rounded-[9px] bg-[#1F4AA8] px-[16px] py-[9px] text-[14px] font-medium text-white transition hover:bg-[#1A3F8F]",
              submitting && "cursor-not-allowed opacity-60 hover:bg-[#1F4AA8]"
            )}
          >
            <Check size={16} />
            {submitting ? "Guardando…" : mode === "edit" ? "Guardar cambios" : "Crear tarea"}
          </button>
        </div>
      </div>
    </div>
  );
}
