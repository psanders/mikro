/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Folds consecutive same-type/same-actor events (as already returned,
 * newest-first) into runs for `GroupedFeedRow` (issue #131). Pure function —
 * called per day group in `FeedScreen`, so a run never crosses a day
 * boundary. `isGroupable` lets the caller exclude events that must keep
 * their own row (task firings carrying a live action widget).
 */
import type { FeedEvent } from "./types";

export type FeedRow = FeedEvent | FeedEvent[];

export function groupFeedRuns(
  events: FeedEvent[],
  isGroupable: (event: FeedEvent) => boolean
): FeedRow[] {
  const rows: FeedRow[] = [];
  let run: FeedEvent[] = [];

  function flush() {
    if (run.length === 0) return;
    rows.push(run.length === 1 ? run[0]! : run);
    run = [];
  }

  for (const event of events) {
    const last = run[run.length - 1];
    const canExtend =
      last !== undefined &&
      isGroupable(event) &&
      isGroupable(last) &&
      event.type === last.type &&
      event.actorId !== undefined &&
      event.actorId === last.actorId;

    if (canExtend) {
      run.push(event);
      continue;
    }
    flush();
    run = [event];
  }
  flush();

  return rows;
}
