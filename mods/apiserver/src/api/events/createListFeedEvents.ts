/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";
import {
  withErrorHandlingAndValidation,
  listFeedEventsSchema,
  amountToNumber
} from "@mikro/common";
import type { EventClient } from "./recordEvent.js";
import { encodeCursor, decodeCursor } from "./helpers.js";

type ListFeedEventsInput = z.infer<typeof listFeedEventsSchema>;

const DEFAULT_LIMIT = 20;

export interface FeedEventItem {
  id: string;
  type: string;
  occurredAt: Date;
  actorId: string | null;
  actorName: string;
  customerId: string | null;
  customerName: string | null;
  loanId: string | null;
  /**
   * Human loan number (`Loan.loanId`), resolved at read time from the row's
   * `loanId` UUID (`Loan.id`) — see {@link enrichLoanNumbers}. `null` when the
   * event has no loan, or the loan was deleted after the event was recorded.
   */
  loanNumber: number | null;
  applicationId: string | null;
  amount: number | null;
  summary: string;
  payload: unknown;
}

export interface ListFeedEventsResult {
  items: FeedEventItem[];
  nextCursor: string | null;
}

function mapRow(row: {
  id: string;
  type: string;
  occurredAt: Date;
  actorId: string | null;
  actorName: string;
  customerId: string | null;
  customerName: string | null;
  loanId: string | null;
  applicationId: string | null;
  amount: unknown;
  summary: string;
  payload: string;
}): FeedEventItem {
  return {
    id: row.id,
    type: row.type,
    occurredAt: row.occurredAt,
    actorId: row.actorId,
    actorName: row.actorName,
    customerId: row.customerId,
    customerName: row.customerName,
    loanId: row.loanId,
    loanNumber: null,
    applicationId: row.applicationId,
    amount: row.amount == null ? null : amountToNumber(row.amount),
    summary: row.summary,
    payload: JSON.parse(row.payload)
  };
}

/**
 * Resolves each item's `loanId` (UUID) to its human `loanNumber` (`Loan.loanId`,
 * the 10000-series id every copilot loan tool takes) in place, with one batched
 * query for the page's distinct loan ids. Read-time enrichment on purpose: the
 * event payload never carries the numeric number, so this is what lets
 * historical events (recorded before or without a numeric ref) resolve too,
 * with no payload backfill. A `loanId` with no matching row (loan deleted since
 * the event was recorded) is left `null` rather than surfaced as an error.
 */
export async function enrichLoanNumbers(
  client: EventClient,
  items: FeedEventItem[]
): Promise<void> {
  const loanIds = [
    ...new Set(items.map((item) => item.loanId).filter((id): id is string => id != null))
  ];
  if (loanIds.length === 0) return;

  const loans = await client.loan.findMany({
    where: { id: { in: loanIds } },
    select: { id: true, loanId: true }
  });
  const byId = new Map(loans.map((l) => [l.id, l.loanId]));

  for (const item of items) {
    if (item.loanId) item.loanNumber = byId.get(item.loanId) ?? null;
  }
}

/**
 * Overlays the current `outbound_messages` delivery status onto `message.sent`
 * feed items (in place). The card renders its color from `payload.status`, so
 * this is what makes an "enviado" card flip to delivered/read/failed on refetch.
 * A single batched query for the page's message ids; no-op when the page has no
 * message cards.
 */
async function overlayMessageStatus(client: EventClient, items: FeedEventItem[]): Promise<void> {
  const byWaId = new Map<string, FeedEventItem>();
  for (const item of items) {
    if (item.type !== "message.sent") continue;
    const waId = (item.payload as { waMessageId?: unknown }).waMessageId;
    if (typeof waId === "string") byWaId.set(waId, item);
  }
  if (byWaId.size === 0) return;

  const rows = await client.outboundMessage.findMany({
    where: { waMessageId: { in: [...byWaId.keys()] } },
    select: { waMessageId: true, status: true, errorTitle: true }
  });
  for (const row of rows) {
    const item = byWaId.get(row.waMessageId);
    if (!item) continue;
    const payload = item.payload as Record<string, unknown>;
    payload.status = row.status;
    if (row.errorTitle) payload.errorTitle = row.errorTitle;
  }
}

/**
 * Reverse-chronological feed of business events with opaque `(occurredAt, id)`
 * cursor pagination — a deliberate exception to the repo's offset/limit
 * convention: the feed grows at the head, so offsets would skip/duplicate rows
 * between page fetches. The strict keyset predicate keeps pages contiguous and
 * non-overlapping even when new events arrive between requests. Optional
 * type/actor/date filters narrow the stream.
 */
export function createListFeedEvents(client: EventClient) {
  const fn = async (input: ListFeedEventsInput): Promise<ListFeedEventsResult> => {
    const limit = input.limit ?? DEFAULT_LIMIT;

    const and: Array<Record<string, unknown>> = [];
    if (input.types && input.types.length > 0) {
      and.push({ type: { in: input.types } });
    }
    if (input.actorId) and.push({ actorId: input.actorId });
    if (input.from) and.push({ occurredAt: { gte: input.from } });
    if (input.to) and.push({ occurredAt: { lte: input.to } });

    if (input.cursor) {
      const c = decodeCursor(input.cursor);
      if (c) {
        // Strict keyset: everything strictly "older" than the cursor tuple.
        and.push({
          OR: [
            { occurredAt: { lt: c.occurredAt } },
            { AND: [{ occurredAt: c.occurredAt }, { id: { lt: c.id } }] }
          ]
        });
      }
    }

    const rows = await client.businessEvent.findMany({
      where: and.length > 0 ? { AND: and } : undefined,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: limit + 1
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = page.map(mapRow);

    // Overlay live delivery state onto `message.sent` cards. The event payload is
    // frozen at send time (`status: "accepted"`) because the event log is
    // append-only; the mutable truth lives in `outbound_messages`, keyed by the
    // payload's `waMessageId`. One batched lookup keeps this O(1) queries/page.
    await overlayMessageStatus(client, items);
    await enrichLoanNumbers(client, items);

    const last = items[items.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.occurredAt, last.id) : null;

    return { items, nextCursor };
  };

  return withErrorHandlingAndValidation(fn, listFeedEventsSchema);
}
