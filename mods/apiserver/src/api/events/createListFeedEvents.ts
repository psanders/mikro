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
    applicationId: row.applicationId,
    amount: row.amount == null ? null : amountToNumber(row.amount),
    summary: row.summary,
    payload: JSON.parse(row.payload)
  };
}

/**
 * Reverse-chronological feed of business events with opaque `(occurredAt, id)`
 * cursor pagination — a deliberate exception to the repo's offset/limit
 * convention: the feed grows at the head, so offsets would skip/duplicate rows
 * between page fetches. The strict keyset predicate keeps pages contiguous and
 * non-overlapping even when new events arrive between requests. Optional
 * type/date filters narrow the stream.
 */
export function createListFeedEvents(client: EventClient) {
  const fn = async (input: ListFeedEventsInput): Promise<ListFeedEventsResult> => {
    const limit = input.limit ?? DEFAULT_LIMIT;

    const and: Array<Record<string, unknown>> = [];
    if (input.types && input.types.length > 0) {
      and.push({ type: { in: input.types } });
    }
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
    const last = items[items.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.occurredAt, last.id) : null;

    return { items, nextCursor };
  };

  return withErrorHandlingAndValidation(fn, listFeedEventsSchema);
}
