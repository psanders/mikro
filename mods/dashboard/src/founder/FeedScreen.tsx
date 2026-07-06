/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Founder feed home (`/founder`) — Pencil "Feed en vivo" board (`EzobQ`).
 * Reverse-chronological business events grouped by day, backed by
 * `listFeedEvents`'s opaque `(occurredAt, id)` cursor. Cards are compact and
 * expand per-card; the top filter pills narrow the stream server-side. The
 * copilot sparkles button ships inert (a later change owns the dock).
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { RESTORE_WINDOW_DAYS } from "@mikro/common/schemas";
import { cn } from "../lib/cn";
import { trpc, type RouterOutputs } from "../lib/trpc";
import { useToast } from "../components/ui/ToastProvider";
import { isForbidden } from "../lib/applications";
import { useCopilot } from "./copilot/CopilotContext";
import { useAlerts } from "./alerts/AlertsContext";
import { FeedCard } from "./components/FeedCard";
import { FeedDayHeader } from "./components/FeedDayHeader";
import { FeedEmptyState } from "./components/FeedEmptyState";
import { FeedErrorState } from "./components/FeedErrorState";
import { formatDayLabel } from "./components/format";
import { subjectQuestion } from "./components/typeConfig";
import { ALERT_EVENT_TYPES, type FeedEvent, type NavigateTarget } from "./components/types";

const RESTORE_WINDOW_MS = RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

type FeedItem = RouterOutputs["listFeedEvents"]["items"][number];

interface FilterDef {
  id: string;
  label: string;
  types?: FeedEvent["type"][];
}

// Filter pills → event-type sets (server-side via listFeedEvents `types`).
const FILTERS: FilterDef[] = [
  { id: "todo", label: "Todo" },
  { id: "pagos", label: "Pagos", types: ["payment.collected", "payment.reversed"] },
  { id: "contratos", label: "Contratos", types: ["application.signed", "application.converted"] },
  {
    id: "decisiones",
    label: "Decisiones",
    types: ["application.approved", "application.rejected"]
  },
  { id: "alertas", label: "Alertas", types: ALERT_EVENT_TYPES }
];

interface FeedNavState {
  filterId?: string;
}

function toFeedEvent(item: FeedItem): FeedEvent {
  return {
    id: item.id,
    type: item.type as FeedEvent["type"],
    occurredAt: new Date(item.occurredAt).toISOString(),
    actorName: item.actorName,
    customerName: item.customerName ?? undefined,
    loanId: item.loanId ?? undefined,
    applicationId: item.applicationId ?? undefined,
    amount: item.amount ?? undefined,
    summary: item.summary,
    payload: (item.payload ?? {}) as Record<string, unknown>
  };
}

interface DayGroup {
  key: string;
  date: string;
  events: FeedEvent[];
}

/** Groups an already newest-first list by calendar day, preserving order. */
function groupByDay(events: FeedEvent[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const event of events) {
    const day = event.occurredAt.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.key === day) {
      last.events.push(event);
    } else {
      groups.push({ key: day, date: event.occurredAt, events: [event] });
    }
  }
  return groups;
}

export function FeedScreen() {
  const toast = useToast();
  const utils = trpc.useUtils();
  const copilot = useCopilot();
  const alerts = useAlerts();
  const location = useLocation();
  const navState = location.state as FeedNavState | null;
  const [filterId, setFilterId] = useState(navState?.filterId ?? "todo");

  // The rail's "Excepciones" button navigates here with `state.filterId` set
  // — re-sync on every navigation (keyed by location.key so a second click
  // while already on this screen still takes effect).
  useEffect(() => {
    if (navState?.filterId) setFilterId(navState.filterId);
  }, [location.key, navState?.filterId]);

  const activeFilter = FILTERS.find((f) => f.id === filterId) ?? FILTERS[0]!;

  // Viewing the alerts filter acknowledges any unread alert, per issue #109.
  useEffect(() => {
    if (filterId === "alertas") alerts.markSeen();
  }, [filterId, alerts]);

  const feed = trpc.listFeedEvents.useInfiniteQuery(
    activeFilter.types ? { types: activeFilter.types } : {},
    { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined }
  );

  const restore = trpc.restoreApplication.useMutation({
    onSuccess: () => {
      toast.success("Solicitud restaurada.");
      void utils.listFeedEvents.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "No se pudo restaurar la solicitud.");
    }
  });

  const events = useMemo(() => {
    const raw = feed.data?.pages.flatMap((p) => p.items) ?? [];
    return raw.map(toFeedEvent);
  }, [feed.data]);

  const groups = useMemo(() => groupByDay(events), [events]);

  function canRestore(event: FeedEvent): boolean {
    if (event.type !== "application.deleted") return false;
    return Date.now() - new Date(event.occurredAt).getTime() <= RESTORE_WINDOW_MS;
  }

  // Retired ops detail pages no longer exist: "Ver X" opens the copilot dock
  // prefilled with a question about the event's subject instead of navigating.
  function handleNavigate(event: FeedEvent, target: NavigateTarget) {
    copilot.openWith(subjectQuestion(target, event.customerName));
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-[#E5EAF1] px-6 py-[15px]">
        <h1 className="text-[19px] font-semibold tracking-[-0.3px] text-[#14254A]">Feed</h1>
        <button
          type="button"
          onClick={() => copilot.openWith()}
          title="Copiloto"
          aria-label="Copiloto"
          className="relative flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#E9F2FF] text-[#1F4AA8] transition hover:bg-[#dbe8fb]"
        >
          <Sparkles size={17} />
        </button>
      </header>

      <div className="flex shrink-0 gap-2 border-b border-[#E5EAF1] px-6 py-3">
        {FILTERS.map((f) => {
          const active = f.id === filterId;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterId(f.id)}
              className={cn(
                "rounded-full px-[14px] py-[6px] text-[12px] font-semibold transition",
                active
                  ? "bg-[#14254A] text-white"
                  : "bg-[#EEF3F9] text-[#697A93] hover:bg-[#E5EAF1]"
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {feed.isPending && (
          <div className="px-6 py-4 text-sm font-medium text-[#697A93]">Cargando…</div>
        )}

        {feed.isError && (
          <div className="p-6">
            <FeedErrorState
              description={
                isForbidden(feed.error)
                  ? "No tienes acceso al feed."
                  : "Verifica tu conexión e inténtalo de nuevo."
              }
              onRetry={() => void feed.refetch()}
            />
          </div>
        )}

        {feed.isSuccess && events.length === 0 && (
          <div className="p-6">
            <FeedEmptyState />
          </div>
        )}

        {groups.map((group) => (
          <div key={group.key}>
            {formatDayLabel(group.date) !== "Hoy" && <FeedDayHeader date={group.date} />}
            {group.events.map((event) => (
              <FeedCard
                key={event.id}
                event={event}
                canRestore={canRestore(event)}
                onRestore={(e) => restore.mutate({ deletionEventId: e.id })}
                onNavigate={(target) => handleNavigate(event, target)}
                onAskCopilot={(question) => copilot.openWith(question)}
              />
            ))}
          </div>
        ))}

        {feed.hasNextPage && (
          <div className="flex justify-center py-4">
            <button
              type="button"
              disabled={feed.isFetchingNextPage}
              onClick={() => void feed.fetchNextPage()}
              className="rounded-full bg-[#E9F2FF] px-[18px] py-[8px] text-[12px] font-semibold text-[#1F4AA8] transition hover:bg-[#dbe8fb] disabled:opacity-60"
            >
              {feed.isFetchingNextPage ? "Cargando…" : "Cargar más"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
