/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The empty-thread intro — Pencil `intro`: a lead line plus the four verb
 * groups (CONSULTAR / ACTUAR / VIGILAR / AUDITAR), each an icon+label header
 * over a row of example-prompt chips. Clicking a chip emits its prompt so the
 * parent can prefill the composer.
 */
import type { LucideIcon } from "lucide-react";
import { Bell, ChartColumn, ScrollText, Zap } from "lucide-react";
import { cn } from "../../lib/cn";
import type { CapabilityGroup, CapabilityVerb } from "./types";

const INTRO_TEXT = "¿Qué necesitas? Puedo hacer todo lo que harías en las apps:";

const VERB_ICON: Record<CapabilityVerb, LucideIcon> = {
  CONSULTAR: ChartColumn,
  ACTUAR: Zap,
  VIGILAR: Bell,
  AUDITAR: ScrollText
};

/** The verb groups shown in the export; also the default when none is passed. */
export const DEFAULT_CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    verb: "CONSULTAR",
    chips: [{ label: "¿Cómo cerró la cobranza?" }, { label: "Mora por ruta" }]
  },
  {
    verb: "ACTUAR",
    chips: [{ label: "Registrar un pago" }, { label: "Firmar la excepción #487" }]
  },
  {
    verb: "VIGILAR",
    chips: [{ label: "Avísame si la mora sube" }, { label: "Resumen diario 6 p. m." }]
  },
  {
    verb: "AUDITAR",
    chips: [{ label: "¿Quién borró la #479?" }, { label: "Exportar eventos de junio" }]
  }
];

export interface CapabilityChipsProps {
  groups?: CapabilityGroup[];
  onPick: (prompt: string) => void;
  className?: string;
}

export function CapabilityChips({
  groups = DEFAULT_CAPABILITY_GROUPS,
  onPick,
  className
}: CapabilityChipsProps) {
  return (
    <div className={cn("flex w-full flex-col gap-[10px]", className)}>
      <p className="w-full text-[13px] font-medium leading-[20px] text-[#14254A]">{INTRO_TEXT}</p>
      {groups.map((group) => {
        const Icon = VERB_ICON[group.verb];
        return (
          <div key={group.verb} className="flex w-full flex-col gap-[6px]">
            <div className="flex items-center gap-[6px] text-[#697A93]">
              <Icon size={13} strokeWidth={2} className="shrink-0" />
              <span className="text-[10px] font-semibold tracking-[0.8px]">{group.verb}</span>
            </div>
            <div className="flex w-full flex-wrap gap-[6px]">
              {group.chips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => onPick(chip.prompt ?? chip.label)}
                  className="w-fit rounded-[9px] bg-[#EEF3F9] px-[11px] py-[7px] text-[11px] font-medium text-[#14254A] transition hover:bg-[#E1E9F3]"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
