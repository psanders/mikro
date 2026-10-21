/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * One card per renewal at its newest event (like applications): older events of
 * the same renewal live in the panel, not as extra cards.
 */
import type { FeedEvent } from "../components/types";

export type RenewalEvent = FeedEvent & {
  renewalId: string;
  renewal: NonNullable<FeedEvent["renewal"]>;
};

export function isRenewalEvent(e: FeedEvent): e is RenewalEvent {
  return Boolean(e.renewalId && e.type.startsWith("loan.renewal.") && e.renewal);
}

/** Keep only the newest event per renewal (the list is newest-first). */
export function latestPerRenewal(events: FeedEvent[]): FeedEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    if (!e.renewalId || !e.type.startsWith("loan.renewal.")) return true;
    if (seen.has(e.renewalId)) return false;
    seen.add(e.renewalId);
    return true;
  });
}
