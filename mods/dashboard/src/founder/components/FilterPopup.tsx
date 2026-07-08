/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Feed filter panel, Pencil "Filtro — panel abierto" mockup. Tipo (multi-select),
 * Actor (single-select), Rango de fechas (presets + custom). Purely
 * presentational/controlled — `FilterBar` owns the draft state, open/close,
 * and outside-click dismissal.
 */
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "../../lib/cn";
import {
  DATE_PRESET_LABELS,
  FEED_TYPE_GROUPS,
  type FeedDatePreset,
  type FeedFilterValue
} from "./feedFilters";

export interface FilterPopupActor {
  id: string;
  name: string;
}

export interface FilterPopupProps {
  value: FeedFilterValue;
  onChange: (value: FeedFilterValue) => void;
  actors: FilterPopupActor[];
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
}

const SECTION_LABEL = "text-[11px] font-semibold tracking-[0.4px] text-[#8FA3C8]";

export function FilterPopup({
  value,
  onChange,
  actors,
  onApply,
  onClear,
  onClose
}: FilterPopupProps) {
  const selectedActor = actors.find((a) => a.id === value.actorId);

  function toggleType(id: string) {
    const next = value.typeIds.includes(id)
      ? value.typeIds.filter((t) => t !== id)
      : [...value.typeIds, id];
    onChange({ ...value, typeIds: next });
  }

  function setPreset(preset: FeedDatePreset) {
    onChange({ ...value, preset });
  }

  return (
    <div className="flex w-[320px] flex-col rounded-[14px] border border-[#E5EAF1] bg-white shadow-[0_16px_40px_rgba(20,37,74,0.2)]">
      <div className="flex items-center justify-between border-b border-[#E5EAF1] px-4 py-[14px]">
        <span className="text-[15px] font-semibold text-[#14254A]">Filtrar</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex h-5 w-5 items-center justify-center text-[#697A93] hover:text-[#14254A]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-[18px] p-4">
        <div className="flex flex-col gap-[10px]">
          <span className={SECTION_LABEL}>TIPO</span>
          <div className="flex flex-col gap-[9px]">
            {FEED_TYPE_GROUPS.map((group) => {
              const checked = value.typeIds.includes(group.id);
              return (
                <label key={group.id} className="flex cursor-pointer items-center gap-[9px]">
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-[4px] border",
                      checked
                        ? "border-brand-blue-primary bg-brand-blue-primary"
                        : "border-[#E5EAF1] bg-white"
                    )}
                  >
                    {checked && <Check size={11} className="text-white" />}
                  </span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggleType(group.id)}
                  />
                  <span className="text-[13px] font-medium text-[#14254A]">{group.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-[10px]">
          <span className={SECTION_LABEL}>ACTOR</span>
          <div className="relative">
            <select
              value={value.actorId ?? ""}
              onChange={(e) => onChange({ ...value, actorId: e.target.value || undefined })}
              className="w-full appearance-none rounded-[8px] border border-[#E5EAF1] bg-white px-[12px] py-[10px] text-[13px] font-medium text-[#14254A]"
            >
              <option value="">Todos</option>
              {actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-[12px] top-1/2 -translate-y-1/2 text-[#697A93]"
            />
          </div>
          {selectedActor && (
            <span className="text-[11px] font-medium text-[#8FA3C8]">{selectedActor.name}</span>
          )}
        </div>

        <div className="flex flex-col gap-[10px]">
          <span className={SECTION_LABEL}>RANGO DE FECHAS</span>
          {value.preset === "custom" && (
            <div className="flex gap-[8px]">
              <input
                type="date"
                value={value.from}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
                className="w-full rounded-[8px] border border-[#E5EAF1] bg-white px-[10px] py-[9px] text-[13px] font-medium text-[#14254A]"
              />
              <input
                type="date"
                value={value.to}
                onChange={(e) => onChange({ ...value, to: e.target.value })}
                className="w-full rounded-[8px] border border-[#E5EAF1] bg-white px-[10px] py-[9px] text-[13px] font-medium text-[#14254A]"
              />
            </div>
          )}
          <div className="flex gap-[8px]">
            {(["hoy", "7d", "30d", "custom"] as FeedDatePreset[]).map((preset) => {
              const active = value.preset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPreset(preset)}
                  className={cn(
                    "rounded-full px-3 py-[6px] text-[11px] font-semibold",
                    active ? "bg-[#14254A] text-white" : "bg-[#EEF3F9] text-[#697A93]"
                  )}
                >
                  {DATE_PRESET_LABELS[preset]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-[10px] border-t border-[#E5EAF1] px-4 py-[14px]">
        <button
          type="button"
          onClick={onClear}
          className="rounded-[9px] border border-[#E5EAF1] bg-white px-4 py-[9px] text-[13px] font-medium text-[#14254A] hover:bg-[#F4F7FB]"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={onApply}
          className="rounded-[9px] bg-brand-blue-primary px-4 py-[9px] text-[13px] font-semibold text-white hover:opacity-90"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}
