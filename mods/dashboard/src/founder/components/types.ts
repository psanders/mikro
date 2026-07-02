/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { BusinessEventType } from "@mikro/common";

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

export type NavigateTargetKind = "application" | "loan" | "customer";

export interface NavigateTarget {
  kind: NavigateTargetKind;
  id: string;
}

export type { BusinessEventType };
