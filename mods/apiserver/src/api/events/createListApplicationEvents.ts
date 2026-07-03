/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";
import { withErrorHandlingAndValidation, listApplicationEventsSchema } from "@mikro/common";
import type { EventClient } from "./recordEvent.js";

type ListApplicationEventsInput = z.infer<typeof listApplicationEventsSchema>;

const DEFAULT_LIMIT = 20;

export interface ApplicationEventItem {
  id: string;
  type: string;
  occurredAt: Date;
  actorName: string;
  summary: string;
}

export interface ListApplicationEventsResult {
  items: ApplicationEventItem[];
}

/**
 * Reviewer-facing activity history for one application (mikro/#67). Deliberately
 * narrower than `listFeedEvents`: no cursor, no cross-application data, and the
 * response omits `payload`/`amount`/customer/loan ids — the mobile "Ver
 * actividad" list only needs a summary line and a timestamp per event.
 */
export function createListApplicationEvents(client: EventClient) {
  const fn = async (input: ListApplicationEventsInput): Promise<ListApplicationEventsResult> => {
    const limit = input.limit ?? DEFAULT_LIMIT;

    const rows = await client.businessEvent.findMany({
      where: { applicationId: input.applicationId },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: limit
    });

    return {
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        occurredAt: r.occurredAt,
        actorName: r.actorName,
        summary: r.summary
      }))
    };
  };

  return withErrorHandlingAndValidation(fn, listApplicationEventsSchema);
}
