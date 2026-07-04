/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The Actuar confirm card — Pencil "Acción del copiloto" specimen: a sparkles
 * header (Copiloto · summary), a narrative line spelling out the exact
 * arguments that would execute (same prose pattern as the feed's narrative
 * sentences — see founder/components/typeConfig.ts — but every value stays
 * verbatim, unrounded and untranslated, since this is a pre-write safety
 * check, not a historical record), and Confirmar / Cancelar controls.
 * Nothing runs until the founder confirms. Renders four states:
 *   - pending   → active Confirmar (primary) / Cancelar
 *   - confirmed → green check, no controls
 *   - rejected  → muted, "Rechazada"
 *   - expired   → disabled controls + "Expirada" note
 */
import { CircleCheck, Sparkles } from "lucide-react";
import { cn } from "../../lib/cn";
import { humanizeKey, humanizeValue } from "../components/format";
import { ASSISTANT_TEXT_CLASS } from "./AssistantMessage";
import type { CopilotPendingAction, PendingActionState } from "./types";

export interface PendingActionCardProps {
  action: CopilotPendingAction;
  /** Visual lifecycle state. Defaults to `action.status` mapped to lowercase. */
  state?: PendingActionState;
  onConfirm?: (action: CopilotPendingAction) => void;
  onReject?: (action: CopilotPendingAction) => void;
  className?: string;
}

function resolveState(props: PendingActionCardProps): PendingActionState {
  if (props.state) return props.state;
  switch (props.action.status) {
    case "CONFIRMED":
      return "confirmed";
    case "REJECTED":
      return "rejected";
    case "EXPIRED":
      return "expired";
    default:
      return "pending";
  }
}

/**
 * Flowing "key valor, key valor" prose for the confirm card — narrative
 * style like the feed, but every value is shown exactly as-is (no rounding,
 * no per-type phrasing) because the founder is verifying what will execute,
 * not reading a summary of what already happened.
 */
function argsNarrative(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(([key, value]) => `${humanizeKey(key).toLowerCase()} ${humanizeValue(value)}`)
    .join(", ");
}

export function PendingActionCard(props: PendingActionCardProps) {
  const { action, onConfirm, onReject, className } = props;
  const state = resolveState(props);
  const confirmed = state === "confirmed";
  const muted = state === "rejected";
  const expired = state === "expired";

  const argEntries = Object.entries(action.args);

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-[12px] rounded-[14px] border border-[#E5EAF1] bg-white p-[16px]",
        muted && "opacity-70",
        className
      )}
    >
      <div className="flex items-center gap-[12px]">
        <div
          className={cn(
            "flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[11px]",
            confirmed ? "bg-[#E8F7EE]" : "bg-[#E9F2FF]"
          )}
        >
          {confirmed ? (
            <CircleCheck size={17} strokeWidth={2} className="text-[#16A34A]" />
          ) : (
            <Sparkles size={17} strokeWidth={2} className="text-[#1F4AA8]" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <p className={cn(ASSISTANT_TEXT_CLASS, "break-words")}>
            <span className="font-semibold">Copiloto </span>
            <span className="font-medium">{action.summary}</span>
          </p>
          <p
            className={cn(
              "text-[12px] font-semibold leading-tight",
              confirmed && "text-[#16A34A]",
              expired && "text-[#DC2626]",
              muted && "text-[#697A93]",
              state === "pending" && "text-[#1F4AA8]"
            )}
          >
            {state === "pending" && "Requiere tu confirmación"}
            {confirmed && "Confirmada por ti"}
            {muted && "Rechazada"}
            {expired && "Expirada · ya no se puede confirmar"}
          </p>
        </div>
      </div>

      {argEntries.length > 0 && (
        <p className="break-words rounded-[10px] border border-[#E5EAF1] bg-[#F4F7FB] px-[12px] py-[10px] text-[12px] leading-[18px] text-[#697A93]">
          {argsNarrative(action.args)}
        </p>
      )}

      {state !== "confirmed" && state !== "rejected" && (
        <div className="flex flex-wrap items-center gap-[8px]">
          <button
            type="button"
            disabled={expired}
            onClick={() => onConfirm?.(action)}
            className={cn(
              "inline-flex items-center gap-[7px] rounded-[9px] bg-[#1F4AA8] px-[16px] py-[9px] text-[14px] font-medium text-white transition hover:bg-[#1A3F8F]",
              expired && "cursor-not-allowed opacity-50 hover:bg-[#1F4AA8]"
            )}
          >
            Confirmar
          </button>
          <button
            type="button"
            disabled={expired}
            onClick={() => onReject?.(action)}
            className={cn(
              "inline-flex items-center gap-[7px] rounded-[9px] border border-[#E5EAF1] bg-white px-[16px] py-[9px] text-[14px] font-medium text-[#14254A] transition hover:bg-[#F4F7FB]",
              expired && "cursor-not-allowed opacity-50 hover:bg-white"
            )}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
