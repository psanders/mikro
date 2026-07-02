/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * A single feed row, Pencil "Feed en vivo" board `zmif2`. Compact by default
 * (icon chip · summary · meta · clock · chevron); expands in place to a KV
 * detail grid plus type-specific actions. Expansion is per-card and, when
 * uncontrolled, owned here. `application.deleted` renders with the red
 * treatment and a "Restaurar" action while the 30-day window is open; the
 * policy-exception approval renders amber.
 */
import { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { cn } from "../../lib/cn";
import { FeedTypeIcon } from "./FeedTypeIcon";
import { formatClockTime } from "./format";
import {
  isDeletion,
  resolveCardTint,
  resolveCompactMeta,
  resolveDetailRows,
  resolveSubjectLink
} from "./typeConfig";
import type { FeedEvent, NavigateTarget } from "./types";

export interface FeedCardProps {
  event: FeedEvent;
  /** Controlled expansion — omit to let the card own its own state. */
  expanded?: boolean;
  /** Initial expansion when uncontrolled. Default collapsed. */
  defaultExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  /**
   * Only consulted for `application.deleted`: whether the 30-day restore
   * window is still open. Defaults to false (no action offered).
   */
  canRestore?: boolean;
  onRestore?: (event: FeedEvent) => void;
  onNavigate?: (target: NavigateTarget) => void;
  className?: string;
}

// Full-card tint per Pencil: deletions on a faint red wash, policy exceptions
// on a faint amber wash. No left rule — the tinted icon chip carries the accent.
const CARD_TINT: Record<"amber" | "red", string> = {
  amber: "bg-[#FDF9F0]",
  red: "bg-[#FEF6F6]"
};

const ACT_BUTTON =
  "inline-flex items-center gap-[7px] rounded-[9px] border border-[#E5EAF1] bg-white px-4 py-[9px] text-[14px] font-medium text-[#14254A] transition hover:bg-[#F4F7FB]";

/** Splits "Actor did X" into a bold actor + the medium-weight remainder. */
function splitSummary(summary: string, actorName: string): { lead?: string; rest: string } {
  if (actorName && summary.startsWith(`${actorName} `)) {
    return { lead: actorName, rest: summary.slice(actorName.length + 1) };
  }
  return { rest: summary };
}

export function FeedCard({
  event,
  expanded,
  defaultExpanded = false,
  onToggle,
  canRestore = false,
  onRestore,
  onNavigate,
  className
}: FeedCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = expanded !== undefined;
  const isExpanded = isControlled ? expanded : internalExpanded;

  function handleToggle() {
    const next = !isExpanded;
    if (!isControlled) setInternalExpanded(next);
    onToggle?.(next);
  }

  const tint = resolveCardTint(event);
  const deletion = isDeletion(event);
  const subjectLink = resolveSubjectLink(event);
  const detailRows = resolveDetailRows(event);
  const meta = resolveCompactMeta(event);
  const { lead, rest } = splitSummary(event.summary, event.actorName);
  const ChevronIcon = isExpanded ? ChevronUp : ChevronDown;

  const metaText = deletion && !canRestore ? "Ventana de restauración vencida" : meta.text;
  const metaClass =
    meta.tone === "red" && !(deletion && !canRestore)
      ? "text-[#DC2626] font-semibold"
      : "text-[#697A93] font-medium";

  return (
    <div className={cn("w-full border-b border-[#E5EAF1]", tint && CARD_TINT[tint], className)}>
      <div className={cn("flex flex-col gap-3 px-6", isExpanded ? "pt-3 pb-4" : "py-3")}>
        <div className="flex items-center gap-[14px]">
          <FeedTypeIcon event={event} />
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <p className="truncate text-[14px] leading-tight text-[#14254A]">
              {lead && <span className="font-bold">{lead} </span>}
              <span className="font-medium">{rest}</span>
            </p>
            {metaText && (
              <p className={cn("truncate text-[12px] leading-tight", metaClass)}>{metaText}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-[10px]">
            <span className="text-[12px] font-medium text-[#697A93]">
              {formatClockTime(event.occurredAt)}
            </span>
            <button
              type="button"
              onClick={handleToggle}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Contraer" : "Expandir"}
              className="flex items-center justify-center text-[#697A93]"
            >
              <ChevronIcon size={15} />
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="flex flex-col gap-[10px] pl-[50px]">
            {detailRows.length > 0 && (
              <div className="flex w-full flex-wrap rounded-[10px] border border-[#E5EAF1] bg-white px-[14px]">
                {detailRows.map((row, i) => (
                  <div
                    key={`${row.label}-${i}`}
                    className="flex min-w-[120px] flex-1 flex-col gap-[1px] py-2"
                  >
                    <span className="text-[11px] font-medium text-[#697A93]">{row.label}</span>
                    <span className="text-[13px] font-semibold text-[#14254A]">{row.value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-[10px]">
              {deletion ? (
                canRestore ? (
                  <>
                    <button type="button" onClick={() => onRestore?.(event)} className={ACT_BUTTON}>
                      Restaurar
                    </button>
                    <span
                      title="Próximamente"
                      aria-disabled="true"
                      className="inline-flex cursor-not-allowed items-center gap-[7px] rounded-full bg-[#E9F2FF] px-[14px] py-2 text-[12px] font-semibold text-[#1F4AA8] opacity-80"
                    >
                      <Sparkles size={13} />
                      ¿Qué se borró esta semana?
                    </span>
                  </>
                ) : (
                  <span className="text-[13px] font-medium text-[#697A93]">
                    Ventana de restauración vencida
                  </span>
                )
              ) : (
                subjectLink && (
                  <button
                    type="button"
                    onClick={() => onNavigate?.(subjectLink.target)}
                    className={ACT_BUTTON}
                  >
                    {subjectLink.label}
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
