/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { BusinessEventType } from "@mikro/common";
import type { RouterOutputs } from "../../lib/trpc";

/**
 * Presentational shape for a single feed card. Pages map the tRPC
 * `listFeedEvents` output onto this — kept independent of the wire schema so
 * Storybook and pages can evolve separately.
 */
export interface FeedEvent {
  id: string;
  type: BusinessEventType;
  /** ISO 8601 timestamp. */
  occurredAt: string;
  actorName: string;
  customerName?: string;
  loanId?: string;
  applicationId?: string;
  amount?: number;
  /** Human, Spanish one-liner — rendered as-is as the card's main line. */
  summary: string;
  payload: Record<string, unknown>;
}

/**
 * Event types that count as an "alert" (issue #109) — shared by the feed's
 * "Alertas" filter pill and the rail's unread-badge polling so the two stay
 * in sync.
 */
export const ALERT_EVENT_TYPES: BusinessEventType[] = [
  "application.deleted",
  "application.restored",
  "loan.status_changed"
];

export type NavigateTargetKind = "application" | "loan" | "customer";

export interface NavigateTarget {
  kind: NavigateTargetKind;
  id: string;
}

export type { BusinessEventType };

/** Raw `listFeedEvents` row, before it's mapped onto {@link FeedEvent}. */
export type FeedItem = RouterOutputs["listFeedEvents"]["items"][number];

/**
 * Wire → presentational mapping shared by every consumer of `listFeedEvents`
 * (the feed screen's paginated list, the OS-notification poll in
 * `osAlertNotifications.ts`, …) so there's exactly one place that knows the
 * wire shape.
 */
export function toFeedEvent(item: FeedItem): FeedEvent {
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
