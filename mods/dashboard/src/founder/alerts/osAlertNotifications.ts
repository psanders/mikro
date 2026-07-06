/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * OS-level notification for feed events that render with a red or amber card
 * accent (issue #124) — deletions, rejections, reversed payments, watch-rule
 * alerts, policy-exception approvals, and task firings (a new task due or
 * running under an auto gate, one needing input, or one that failed; see
 * `task.due`'s two summary branches in processDueTasks.ts). Deliberately
 * separate from `AlertsContext` — that's issue #109's "Excepciones" badge, a
 * fixed 3-type list unrelated to card color (it includes `loan.status_changed`,
 * which renders neutral) — the two answer different questions and only
 * incidentally overlap.
 *
 * Only fires on the transition to a genuinely new id after the first poll
 * establishes a baseline, so opening the app never notifies for whatever was
 * already sitting in the feed.
 */
import { useEffect, useRef } from "react";
import { trpc } from "../../lib/trpc";
import { notifyOS } from "../../lib/osNotify";
import { ACCENT_ALERT_EVENT_TYPES, resolveVisual } from "../components/typeConfig";
import { toFeedEvent, type FeedEvent } from "../components/types";

const POLL_INTERVAL_MS = 20_000;
// >1: several fetched items can be non-qualifying application.approved rows
// (plain approvals share the query so a policy-exception one isn't missed).
const POLL_LIMIT = 5;

function firstAccentMatch(items: FeedEvent[]): FeedEvent | null {
  return (
    items.find((event) => {
      const accent = resolveVisual(event).accent;
      return accent === "red" || accent === "amber";
    }) ?? null
  );
}

/** Mount once (in FounderShell) to arm the OS notification for the session. */
export function useOsAlertNotifications(): void {
  const query = trpc.listFeedEvents.useQuery(
    { types: ACCENT_ALERT_EVENT_TYPES, limit: POLL_LIMIT },
    { refetchInterval: POLL_INTERVAL_MS, refetchOnWindowFocus: true }
  );

  // `undefined` = no baseline yet (first successful poll only sets it, never
  // notifies). Once set, any different id is a genuinely new match.
  const previousId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const items = query.data?.items;
    if (!items) return;
    const match = firstAccentMatch(items.map(toFeedEvent));
    if (!match) return;

    if (previousId.current === undefined) {
      previousId.current = match.id;
      return;
    }
    if (match.id !== previousId.current) {
      previousId.current = match.id;
      const title = match.type.startsWith("task.") ? "Mikro — tarea programada" : "Mikro — alerta";
      void notifyOS(title, match.summary);
    }
  }, [query.data]);
}
