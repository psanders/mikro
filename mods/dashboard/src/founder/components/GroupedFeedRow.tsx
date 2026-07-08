/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Collapsible summary row for a run of consecutive same-type/same-actor feed
 * events (issue #131 — reduces noise from repeated routine events like a
 * string of payments from one collector). Pencil "Evento agrupado (racha
 * consecutiva)" specimen, catalog `zmif2`. Collapsed by default; expanding
 * reveals each underlying event as its normal `FeedCard`, newest-first.
 */
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/cn";
import { FeedCard } from "./FeedCard";
import { FeedTypeIcon } from "./FeedTypeIcon";
import { formatRelativeTime } from "./format";
import type { BusinessEventType, FeedEvent, NavigateTarget } from "./types";

const GROUP_LABELS: Partial<Record<BusinessEventType, (count: number) => string>> = {
  "payment.collected": (n) => `${n} pagos recibidos`,
  "payment.reversed": (n) => `${n} pagos revertidos`,
  "message.sent": (n) => `${n} mensajes enviados`,
  "task.completed": (n) => `${n} tareas completadas`,
  "task.failed": (n) => `${n} tareas fallidas`,
  "customer.created": (n) => `${n} clientes creados`,
  "application.signed": (n) => `${n} contratos firmados`,
  "qcobro.synced": (n) => `${n} sincronizaciones de QCobro`
};

function groupLabel(type: BusinessEventType, count: number): string {
  const fn = GROUP_LABELS[type];
  if (fn) return fn(count);
  return `${count} eventos`;
}

export interface GroupedFeedRowProps {
  /** A run of 2+ events sharing the same `type` and `actorId`, newest-first. */
  events: FeedEvent[];
  canRestore?: (event: FeedEvent) => boolean;
  onRestore?: (event: FeedEvent) => void;
  onNavigate?: (event: FeedEvent, target: NavigateTarget) => void;
  onAskCopilot?: (question: string) => void;
  className?: string;
}

export function GroupedFeedRow({
  events,
  canRestore,
  onRestore,
  onNavigate,
  onAskCopilot,
  className
}: GroupedFeedRowProps) {
  const [expanded, setExpanded] = useState(false);
  const head = events[0];
  if (!head) return null;

  if (expanded) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="flex w-full items-center gap-[10px] border-b border-[#E5EAF1] bg-[#F4F7FB] px-6 py-[10px] text-left text-[12px] font-semibold text-[#697A93] hover:bg-[#EEF3F9]"
        >
          <ChevronUp size={14} />
          Contraer {groupLabel(head.type, events.length).toLowerCase()}
        </button>
        {events.map((event) => (
          <FeedCard
            key={event.id}
            event={event}
            canRestore={canRestore?.(event) ?? false}
            onRestore={onRestore}
            onNavigate={(target) => onNavigate?.(event, target)}
            onAskCopilot={onAskCopilot}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setExpanded(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setExpanded(true);
        }
      }}
      aria-expanded={false}
      className={cn(
        "flex w-full cursor-pointer items-center gap-[14px] border-b border-[#E5EAF1] px-6 py-3",
        className
      )}
    >
      <FeedTypeIcon event={head} />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <p className="truncate text-[14px] leading-tight text-[#14254A]">
          <span className="font-semibold">{groupLabel(head.type, events.length)}</span>
        </p>
        <p className="truncate text-[12px] leading-tight font-medium text-[#697A93]">
          {head.actorName} · {formatRelativeTime(head.occurredAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-[10px] text-[#697A93]">
        <ChevronDown size={15} />
      </div>
    </div>
  );
}
