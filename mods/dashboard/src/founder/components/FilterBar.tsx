/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Feed's persistent filter bar, below the header — Pencil "Feed en vivo"
 * `filterChips` row. Active-filter chips flow from the left, the filter
 * icon sits right-aligned and opens `FilterPopup`. The bar always renders
 * (icon-only when nothing is filtered) so applying/clearing filters never
 * shifts the feed content below (see design.md).
 *
 * Deliberately NOT next to the header's copilot (sparkles) icon — that's a
 * separate, cross-app feature; this bar's trigger lives with its own output.
 */
import { useEffect, useRef, useState } from "react";
import { ListFilter, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { FilterPopup, type FilterPopupActor } from "./FilterPopup";
import {
  DATE_PRESET_LABELS,
  FEED_TYPE_GROUPS,
  isFeedFilterActive,
  type FeedFilterValue
} from "./feedFilters";

export interface FilterBarProps {
  value: FeedFilterValue;
  actors: FilterPopupActor[];
  onApply: (value: FeedFilterValue) => void;
}

interface Chip {
  key: "types" | "actor" | "date";
  label: string;
}

function buildChips(value: FeedFilterValue, actors: FilterPopupActor[]): Chip[] {
  const chips: Chip[] = [];
  if (value.typeIds.length > 0) {
    const labels = FEED_TYPE_GROUPS.filter((g) => value.typeIds.includes(g.id)).map((g) => g.label);
    chips.push({ key: "types", label: labels.join(", ") });
  }
  if (value.actorId) {
    const actor = actors.find((a) => a.id === value.actorId);
    chips.push({ key: "actor", label: actor?.name ?? "Actor" });
  }
  if (value.preset !== "hoy") {
    const label =
      value.preset === "custom" ? `${value.from} – ${value.to}` : DATE_PRESET_LABELS[value.preset];
    chips.push({ key: "date", label });
  }
  return chips;
}

export function FilterBar({ value, actors, onApply }: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function openPopup() {
    setDraft(value);
    setOpen(true);
  }

  function apply() {
    onApply(draft);
    setOpen(false);
  }

  function clearAll() {
    const cleared: FeedFilterValue = {
      typeIds: [],
      actorId: undefined,
      preset: "hoy",
      from: value.from,
      to: value.to
    };
    setDraft(cleared);
    onApply(cleared);
    setOpen(false);
  }

  function removeChip(key: Chip["key"]) {
    const next: FeedFilterValue = { ...value };
    if (key === "types") next.typeIds = [];
    if (key === "actor") next.actorId = undefined;
    if (key === "date") next.preset = "hoy";
    onApply(next);
  }

  const chips = buildChips(value, actors);
  const active = isFeedFilterActive(value);

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-[#E5EAF1] px-6 py-3">
      <div className="flex flex-wrap items-center gap-[8px]">
        {chips.map((chip) => (
          <span
            key={chip.key}
            className="flex items-center gap-[6px] rounded-full bg-[#EEF3F9] py-[6px] pl-[14px] pr-[10px] text-[12px] font-semibold text-[#14254A]"
          >
            {chip.label}
            <button
              type="button"
              onClick={() => removeChip(chip.key)}
              aria-label={`Quitar filtro ${chip.label}`}
              className="flex items-center justify-center text-[#697A93] hover:text-[#14254A]"
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      <div ref={rootRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openPopup())}
          title="Filtrar"
          aria-label="Filtrar"
          aria-expanded={open}
          className={cn(
            "flex h-[30px] w-[30px] items-center justify-center rounded-[9px] transition",
            active ? "bg-brand-blue-primary text-white" : "bg-brand-mist text-brand-blue-primary"
          )}
        >
          <ListFilter size={15} />
        </button>
        {open && (
          <div className="absolute right-0 top-[38px] z-20">
            <FilterPopup
              value={draft}
              onChange={setDraft}
              actors={actors}
              onApply={apply}
              onClear={clearAll}
              onClose={() => setOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
