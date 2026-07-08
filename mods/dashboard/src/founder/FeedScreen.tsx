/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Founder feed home (`/founder`) — Pencil "Feed en vivo" board (`EzobQ`).
 * Reverse-chronological business events grouped by day, backed by
 * `listFeedEvents`'s opaque `(occurredAt, id)` cursor. Cards are compact and
 * expand per-card; the persistent filter bar (Tipo/Actor/Rango de fechas)
 * narrows the stream server-side and remembers the admin's preference
 * (issue #131). Consecutive same-type/same-actor runs collapse into a
 * `GroupedFeedRow`. The copilot sparkles button ships inert (a later change
 * owns the dock).
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { RESTORE_WINDOW_DAYS } from "@mikro/common/schemas";
import { trpc } from "../lib/trpc";
import { useToast } from "../components/ui/ToastProvider";
import { isForbidden } from "../lib/applications";
import { useCopilot } from "./copilot/CopilotContext";
import { useAlerts } from "./alerts/AlertsContext";
import { FeedCard } from "./components/FeedCard";
import { TaskFeedCard } from "./TaskFeedCard";
import { FilterBar } from "./components/FilterBar";
import { FeedDayHeader } from "./components/FeedDayHeader";
import { FeedEmptyState } from "./components/FeedEmptyState";
import { FeedErrorState } from "./components/FeedErrorState";
import { GroupedFeedRow } from "./components/GroupedFeedRow";
import { formatDayLabel } from "./components/format";
import { subjectQuestion } from "./components/typeConfig";
import { groupFeedRuns } from "./components/groupFeedRuns";
import {
  loadStoredFeedFilters,
  resolveDateRange,
  resolveTypes,
  storeFeedFilters,
  type FeedFilterValue
} from "./components/feedFilters";
import { toFeedEvent, type FeedEvent, type NavigateTarget } from "./components/types";

const RESTORE_WINDOW_MS = RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** Task lifecycle events whose card may carry the live action widget — never grouped. */
function isTaskEvent(event: FeedEvent): boolean {
  return event.type === "task.due" || event.type === "task.needs_input";
}

interface FeedNavState {
  /** Legacy nav-state shape from the rail's "Excepciones" button — mapped onto the alertas filter. */
  filterId?: string;
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

  // Remembered across sessions (issue #131): read once on mount, falling
  // back to the default (Todo / Todos / Hoy) when unset or unparsable.
  const [filterValue, setFilterValue] = useState<FeedFilterValue>(() => loadStoredFeedFilters());

  // The rail's "Excepciones" button navigates here with `state.filterId` set
  // — re-sync on every navigation (keyed by location.key so a second click
  // while already on this screen still takes effect).
  useEffect(() => {
    if (navState?.filterId === "alertas") {
      setFilterValue((v) => ({ ...v, typeIds: ["alertas"] }));
    }
  }, [location.key, navState?.filterId]);

  function applyFilter(next: FeedFilterValue) {
    setFilterValue(next);
    storeFeedFilters(next);
  }

  // Viewing the alertas filter acknowledges any unread alert, per issue #109.
  useEffect(() => {
    if (filterValue.typeIds.includes("alertas")) alerts.markSeen();
  }, [filterValue.typeIds, alerts]);

  const types = useMemo(() => resolveTypes(filterValue), [filterValue]);
  // resolveDateRange defaults `now` to `new Date()` — memoize on `filterValue`
  // alone (not recomputed every render) so the query's `from`/`to` stay
  // stable between renders. Recomputing `to` fresh on every render would
  // change it by milliseconds each time, giving React Query a new query key
  // every render and the feed would never settle out of "Cargando…".
  const { from, to } = useMemo(() => resolveDateRange(filterValue), [filterValue]);

  const feed = trpc.listFeedEvents.useInfiniteQuery(
    {
      ...(types ? { types } : {}),
      ...(filterValue.actorId ? { actorId: filterValue.actorId } : {}),
      from,
      to
    },
    { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined }
  );

  const actorsQuery = trpc.listUsers.useQuery({ limit: 100 });
  const actors = useMemo(
    () => (actorsQuery.data ?? []).map((u) => ({ id: u.id, name: u.name })),
    [actorsQuery.data]
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

      <FilterBar value={filterValue} actors={actors} onApply={applyFilter} />

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
            {groupFeedRuns(group.events, (e) => !isTaskEvent(e)).map((row) => {
              if (Array.isArray(row)) {
                return (
                  <GroupedFeedRow
                    key={row[0]!.id}
                    events={row}
                    canRestore={canRestore}
                    onRestore={(e) => restore.mutate({ deletionEventId: e.id })}
                    onNavigate={handleNavigate}
                    onAskCopilot={(question) => copilot.openWith(question)}
                  />
                );
              }
              const event = row;
              const Card = isTaskEvent(event) ? TaskFeedCard : FeedCard;
              return (
                <Card
                  key={event.id}
                  event={event}
                  canRestore={canRestore(event)}
                  onRestore={(e) => restore.mutate({ deletionEventId: e.id })}
                  onNavigate={(target) => handleNavigate(event, target)}
                  onAskCopilot={(question) => copilot.openWith(question)}
                />
              );
            })}
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
