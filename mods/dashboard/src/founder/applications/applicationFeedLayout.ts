/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Turns a day's feed events into rows, treating applications as things, not
 * event streams (openspec founder-application-flow):
 *  - one card per application, at its newest event, showing its current state
 *    (older events of the same application are in the panel's Actividad tab);
 *  - 2+ applications still in the queue fold into one "nuevas en la cola" row;
 *  - closed applications (converted / rejected / withdrawn) leave the active
 *    list and fold into one "Cerradas" row at the end of the day.
 * Pure: FeedScreen supplies events already deduplicated across days.
 */
import type { FeedEvent } from "../components/types";
import { isClosed } from "../../lib/applications";
import type { FeedApplicationState } from "./ApplicationFeedCard";

export type AppEvent = FeedEvent & { application: FeedApplicationState };

export type DayRow =
  | { kind: "event"; event: FeedEvent }
  | { kind: "application"; event: AppEvent }
  | { kind: "queue"; events: AppEvent[] }
  | { kind: "closed"; events: AppEvent[] };

export function isApplicationEvent(e: FeedEvent): e is AppEvent {
  return Boolean(e.applicationId && e.type.startsWith("application.") && e.application);
}

/**
 * Keep only the newest event per application (the list is newest-first), so
 * each application renders once — at the day of its latest activity.
 */
export function latestPerApplication(events: FeedEvent[]): FeedEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    if (!isApplicationEvent(e)) return true;
    if (seen.has(e.applicationId!)) return false;
    seen.add(e.applicationId!);
    return true;
  });
}

/** Rows for one day's events (already `latestPerApplication`-filtered, newest first). */
export function layoutDay(events: FeedEvent[]): Array<FeedEvent | DayRow> {
  const out: Array<FeedEvent | DayRow> = [];
  const closed: AppEvent[] = [];
  const queued: AppEvent[] = [];
  let queueIndex = -1;

  for (const e of events) {
    if (!isApplicationEvent(e)) {
      out.push(e);
      continue;
    }
    if (isClosed(e.application.status)) {
      closed.push(e);
      continue;
    }
    if (e.application.status === "RECEIVED") {
      if (queueIndex === -1) {
        queueIndex = out.length;
        out.push({ kind: "queue", events: queued });
      }
      queued.push(e);
      continue;
    }
    out.push({ kind: "application", event: e });
  }

  // A single queued application is just a card.
  if (queueIndex !== -1 && queued.length === 1) {
    out[queueIndex] = { kind: "application", event: queued[0]! };
  }
  if (closed.length > 0) out.push({ kind: "closed", events: closed });
  return out;
}

export function isDayRow(x: FeedEvent | DayRow): x is DayRow {
  return "kind" in x;
}
