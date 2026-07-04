/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The "Regla activa" card — Pencil `ruleCard`: a green header band (bell-ring
 * glyph, "Regla activa", the condition line) over a body with an optional
 * evaluation note and the "Editar regla" / "Desactivar" actions. When the rule
 * is disabled the header goes grey ("Regla inactiva") and the toggle reads
 * "Activar"; "Editar regla" prefills the chat via onEdit.
 */
import { BellRing } from "lucide-react";
import { cn } from "../../lib/cn";
import { ruleConditionText } from "./ruleLabels";
import type { CopilotRule } from "./types";

const RULE_SUFFIX = "→ tarjeta en el feed + notificación";

const CARD_BUTTON =
  "w-fit rounded-[9px] border border-[#E5EAF1] bg-white px-[14px] py-[8px] text-[14px] font-medium text-[#14254A] transition hover:bg-[#F4F7FB]";

export interface RuleCardProps {
  rule: CopilotRule;
  /** Optional evaluation note shown in the body (grey). */
  note?: string;
  /** "Editar regla" — parent prefills the composer with the rule. */
  onEdit?: (rule: CopilotRule) => void;
  /** "Desactivar" / "Activar" — parent toggles `enabled`. */
  onDisable?: (rule: CopilotRule) => void;
  className?: string;
}

export function RuleCard({ rule, note, onEdit, onDisable, className }: RuleCardProps) {
  const enabled = rule.enabled ?? true;
  const condition = ruleConditionText(rule);

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-[12px] border border-[#E5EAF1] bg-white",
        !enabled && "opacity-80",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center gap-[10px] px-[14px] py-[11px]",
          enabled ? "bg-[#E8F7EE]" : "bg-[#EEF3F9]"
        )}
      >
        <BellRing
          size={16}
          strokeWidth={2}
          className={cn("shrink-0", enabled ? "text-[#16A34A]" : "text-[#697A93]")}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
          <span
            className={cn(
              "text-[13px] font-semibold",
              enabled ? "text-[#16A34A]" : "text-[#697A93]"
            )}
          >
            {enabled ? "Regla activa" : "Regla inactiva"}
          </span>
          <span className="text-[11px] font-medium text-[#14254A]">
            {condition} {RULE_SUFFIX}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-[10px] px-[14px] py-[12px]">
        {note && (
          <p className="w-full text-[12px] font-medium leading-[18px] text-[#697A93]">{note}</p>
        )}
        <div className="flex flex-wrap items-center gap-[8px]">
          <button type="button" onClick={() => onEdit?.(rule)} className={CARD_BUTTON}>
            Editar regla
          </button>
          <button type="button" onClick={() => onDisable?.(rule)} className={CARD_BUTTON}>
            {enabled ? "Desactivar" : "Activar"}
          </button>
        </div>
      </div>
    </div>
  );
}
