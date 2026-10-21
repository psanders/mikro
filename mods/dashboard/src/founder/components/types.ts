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
  actorId?: string;
  actorName: string;
  customerId?: string;
  customerName?: string;
  loanId?: string;
  /** Human loan number (`Loan.loanId`) — see `enrichLoanNumbers` on the apiserver. */
  loanNumber?: number;
  applicationId?: string;
  /** For loan.renewal.* events: the renewal the card is built from. */
  renewalId?: string;
  amount?: number;
  /** Human, Spanish one-liner — rendered as-is as the card's main line. */
  summary: string;
  payload: Record<string, unknown>;
  /**
   * For application.* events: the application's CURRENT state, joined by the
   * server at read time. Application cards render from this, not the event.
   */
  application?: {
    status: string;
    assignedReviewerId: string | null;
    decidedById: string | null;
    score: number | null;
    businessName: string | null;
    aiSummary: string | null;
  };
  /**
   * For loan.renewal.* events: the renewal's CURRENT state, joined by the
   * server at read time. The renewal card renders from this, not the event.
   */
  renewal?: {
    status: string;
    oldLoanNumber: number;
    newLoanNumber: number | null;
    principal: number;
    termLength: number;
    paymentAmount: number;
    paymentFrequency: string;
    quotedOwed: number | null;
    quotedNet: number | null;
    hasContract: boolean;
    hasSignedContract: boolean;
    cancelReason: string | null;
    createdById: string;
  };
}

/**
 * Event types that count as an "alert" (issue #109) — shared by the feed's
 * "Alertas" filter pill and the rail's unread-badge polling so the two stay
 * in sync.
 */
export const ALERT_EVENT_TYPES: BusinessEventType[] = [
  "application.deleted",
  "application.restored",
  "loan.status_changed",
  "cx.handoff_requested"
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
    actorId: item.actorId ?? undefined,
    actorName: item.actorName,
    customerId: item.customerId ?? undefined,
    customerName: item.customerName ?? undefined,
    loanId: item.loanId ?? undefined,
    loanNumber: item.loanNumber ?? undefined,
    applicationId: item.applicationId ?? undefined,
    renewalId: item.renewalId ?? undefined,
    amount: item.amount ?? undefined,
    summary: item.summary,
    payload: (item.payload ?? {}) as Record<string, unknown>,
    application: item.application ?? undefined,
    renewal: item.renewal ?? undefined
  };
}
