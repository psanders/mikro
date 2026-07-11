/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";
import { withErrorHandlingAndValidation, searchAllSchema, amountToNumber } from "@mikro/common";
import type { EventClient } from "./recordEvent.js";
import { enrichLoanNumbers, type FeedEventItem } from "./createListFeedEvents.js";

type SearchAllInput = z.infer<typeof searchAllSchema>;

const DEFAULT_LIMIT_PER_GROUP = 5;

export interface SearchAllResult {
  customers: Array<{
    id: string;
    name: string;
    phone: string;
    idNumber: string;
  }>;
  loans: Array<{
    id: string;
    loanId: number;
    status: string;
    customerId: string;
    customerName: string | null;
  }>;
  events: FeedEventItem[];
}

/**
 * Universal admin search across customers, loans, and feed events. One free-text
 * term matches customers by name/phone/id number, loans by human loan id or via
 * matching customers, and events by summary/customer/actor text. Each group is
 * independently capped (offset/limit convention).
 */
export function createSearchAll(client: EventClient) {
  const fn = async (input: SearchAllInput): Promise<SearchAllResult> => {
    const q = input.query;
    const limit = input.limitPerGroup ?? DEFAULT_LIMIT_PER_GROUP;

    const customerRows = await client.customer.findMany({
      where: {
        OR: [{ name: { contains: q } }, { phone: { contains: q } }, { idNumber: { contains: q } }]
      },
      select: { id: true, name: true, phone: true, idNumber: true },
      take: limit
    });

    const customerIds = customerRows.map((c) => c.id);
    const numeric = /^\d+$/.test(q.trim()) ? Number(q.trim()) : null;
    const loanOr: Array<Record<string, unknown>> = [];
    if (numeric != null && Number.isSafeInteger(numeric)) loanOr.push({ loanId: numeric });
    if (customerIds.length > 0) loanOr.push({ customerId: { in: customerIds } });

    const loanRows =
      loanOr.length > 0
        ? await client.loan.findMany({
            where: { OR: loanOr },
            select: {
              id: true,
              loanId: true,
              status: true,
              customerId: true,
              customer: { select: { name: true } }
            },
            take: limit
          })
        : [];

    const eventRows = await client.businessEvent.findMany({
      where: {
        OR: [
          { summary: { contains: q } },
          { customerName: { contains: q } },
          { actorName: { contains: q } }
        ]
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: limit
    });

    const events: FeedEventItem[] = eventRows.map((row) => ({
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
    }));
    // Same read-time enrichment as createListFeedEvents — see enrichLoanNumbers.
    await enrichLoanNumbers(client, events);

    return {
      customers: customerRows,
      loans: loanRows.map((l) => ({
        id: l.id,
        loanId: l.loanId,
        status: l.status,
        customerId: l.customerId,
        customerName: l.customer?.name ?? null
      })),
      events
    };
  };

  return withErrorHandlingAndValidation(fn, searchAllSchema);
}
