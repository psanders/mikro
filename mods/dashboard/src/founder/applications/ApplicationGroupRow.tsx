/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Collapsible group rows for applications in the Ops feed:
 *  - "N solicitudes nuevas en la cola" (violet — the viewer can act)
 *  - "N solicitudes cerradas hoy" (not highlighted — Convertida, Rechazada,
 *    Desistida leave the active view; same pattern as completed tasks)
 */
import { useState, type ReactNode } from "react";
import { Archive, ChevronDown, ChevronUp, Inbox, PanelRightOpen } from "lucide-react";
import { cn } from "../../lib/cn";
import { formatClockTime } from "../components/format";
import type { FeedEvent } from "../components/types";
import { useApplicationPanel } from "./ApplicationPanelContext";
import type { FeedApplicationState } from "./ApplicationFeedCard";
import { StatusPill } from "./ui";

type AppEvent = FeedEvent & { application: FeedApplicationState };

function GroupShell({
  tone,
  icon: Icon,
  title,
  meta,
  time,
  defaultOpen,
  testId,
  children
}: {
  tone: "violet" | "plain";
  icon: typeof Inbox;
  title: string;
  meta: string;
  time: string;
  defaultOpen?: boolean;
  testId: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <div
      className={cn("w-full border-b border-[#E5EAF1]", tone === "violet" && "bg-[#FAF7FF]")}
      data-testid={testId}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-[14px] px-6 py-3 text-left"
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]",
            tone === "violet" ? "bg-[#F1EAFE] text-[#7C3AED]" : "bg-[#EEF3F9] text-[#697A93]"
          )}
        >
          <Icon size={17} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span
            className={cn(
              "truncate text-[14px] font-semibold",
              tone === "violet" ? "text-[#14254A]" : "text-[#697A93]"
            )}
          >
            {title}
          </span>
          <span className="truncate text-[12px] font-medium text-[#697A93]">{meta}</span>
        </span>
        <span className="text-[12px] font-medium text-[#697A93]">{time}</span>
        {open ? (
          <ChevronUp size={15} className="text-[#697A93]" />
        ) : (
          <ChevronDown size={15} className="text-[#697A93]" />
        )}
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

/** Two or more queued (RECEIVED) applications in the same day. */
export function QueueGroupRow({ events, children }: { events: AppEvent[]; children: ReactNode }) {
  return (
    <GroupShell
      tone="violet"
      icon={Inbox}
      title={`${events.length} solicitudes nuevas en la cola`}
      meta={events
        .slice(0, 3)
        .map(
          (e) =>
            `${e.customerName ?? "Solicitud"}${e.application.score != null ? ` MS ${e.application.score}` : ""}`
        )
        .join(" · ")}
      time={formatClockTime(events[0]!.occurredAt)}
      testId="queue-group"
    >
      {children}
    </GroupShell>
  );
}

/** The day's closed applications, one compact row each. */
export function ClosedGroupRow({ events, dayLabel }: { events: AppEvent[]; dayLabel: string }) {
  const panel = useApplicationPanel();
  const counts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.application.status] = (acc[e.application.status] ?? 0) + 1;
    return acc;
  }, {});
  const parts = [
    counts.CONVERTED && `${counts.CONVERTED} convertida${counts.CONVERTED > 1 ? "s" : ""}`,
    counts.REJECTED && `${counts.REJECTED} rechazada${counts.REJECTED > 1 ? "s" : ""}`,
    counts.ABANDONED && `${counts.ABANDONED} desistida${counts.ABANDONED > 1 ? "s" : ""}`
  ].filter(Boolean);

  return (
    <GroupShell
      tone="plain"
      icon={Archive}
      title={`${events.length} solicitud${events.length > 1 ? "es" : ""} cerrada${events.length > 1 ? "s" : ""} ${dayLabel.toLowerCase()}`}
      meta={`${parts.join(" · ")} · sin acciones pendientes`}
      time={dayLabel}
      testId="closed-group"
    >
      <div className="flex flex-col pl-[74px] pr-6">
        {events.map((e) => (
          <div
            key={e.id}
            className="flex items-center gap-3 border-t border-[#E5EAF1] py-[9px]"
            data-testid="closed-item"
            data-application-id={e.applicationId}
          >
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[#697A93]">
              <span className="font-semibold">{e.customerName ?? "Solicitud"}</span>
              {e.application.businessName ? ` · ${e.application.businessName}` : ""} · {e.summary}
            </span>
            <StatusPill status={e.application.status} />
            <span className="text-[12px] font-medium text-[#697A93]">
              {formatClockTime(e.occurredAt)}
            </span>
            <button
              type="button"
              aria-label="Ver solicitud"
              onClick={() => panel.open(e.applicationId!)}
              className="text-[#697A93] hover:text-[#14254A]"
            >
              <PanelRightOpen size={14} />
            </button>
          </div>
        ))}
      </div>
    </GroupShell>
  );
}
