/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { PrismaClient } from "../../generated/prisma/client.js";
import { recordEvent } from "../events/recordEvent.js";
import { logger } from "../../logger.js";

/**
 * Category of a business-initiated WhatsApp send. Drives the feed card's copy and
 * whether it produces a card at all (`receipt` and conversational replies are
 * tracked for delivery state but not carded — see `CARDED_KINDS`).
 *
 * NOTE: payment reminders/overdue notices are sent by an external application,
 * not mikro — no "reminder"/"overdue" kind here by design.
 */
export type OutboundMessageKind = "promo" | "payment_confirmation" | "receipt" | "nudge";

/** Kinds that produce a `message.sent` founder-feed card. */
const CARDED_KINDS = new Set<OutboundMessageKind>(["promo", "payment_confirmation"]);

/** Default one-line card summary per kind (Spanish, founder-facing). */
const KIND_SUMMARY: Record<OutboundMessageKind, string> = {
  promo: "Promoción enviada por WhatsApp",
  payment_confirmation: "Recibo enviado por WhatsApp",
  receipt: "Recibo enviado por WhatsApp",
  nudge: "Recordatorio de solicitud enviado por WhatsApp"
};

export interface RecordOutboundMessageArgs {
  /** Meta message id returned by the send API (correlates the status webhook). */
  waMessageId: string;
  phone: string;
  kind: OutboundMessageKind;
  /** Who triggered the send (feed card actor). Defaults to "Mikro". */
  actorName?: string;
  actorId?: string;
  customerId?: string;
  customerName?: string;
  loanId?: string;
  applicationId?: string;
  /** Override the default card summary. */
  summary?: string;
}

/**
 * Records a business-initiated WhatsApp send: emits ONE `message.sent` feed card
 * (for carded kinds) as the timeline anchor, and inserts the mutable
 * `outbound_messages` row (status `accepted`) that the `statuses` webhook later
 * updates in place. Best-effort — never throws, so a tracking failure can never
 * roll back or mask the actual send.
 */
export function createRecordOutboundMessage(db: PrismaClient) {
  return async (args: RecordOutboundMessageArgs): Promise<void> => {
    const carded = CARDED_KINDS.has(args.kind);
    try {
      let feedEventId: string | null = null;
      if (carded) {
        const created = await recordEvent(db, {
          type: "message.sent",
          actorId: args.actorId,
          actorName: args.actorName ?? "Mikro",
          customerId: args.customerId,
          customerName: args.customerName,
          loanId: args.loanId,
          applicationId: args.applicationId,
          summary: args.summary ?? KIND_SUMMARY[args.kind],
          payload: {
            waMessageId: args.waMessageId,
            kind: args.kind,
            phone: args.phone,
            status: "accepted"
          }
        });
        feedEventId = created.id;
      }

      await db.outboundMessage.create({
        data: {
          waMessageId: args.waMessageId,
          feedEventId,
          phone: args.phone,
          kind: args.kind,
          status: "accepted"
        }
      });
    } catch (error) {
      logger.error("failed to record outbound message", {
        waMessageId: args.waMessageId,
        kind: args.kind,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };
}

export type RecordOutboundMessageFn = ReturnType<typeof createRecordOutboundMessage>;
