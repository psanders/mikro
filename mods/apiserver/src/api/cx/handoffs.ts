/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Human hand-off for WhatsApp CX conversations (openspec cx-role-based-agents).
 * While a hand-off is open for a phone no agent replies to it; the person gets
 * a human in Chatwoot. Each inbound message pushes the expiry out, so a
 * hand-off closes on its own after HANDOFF_TTL_MS of quiet.
 */
import type { PrismaClient } from "../../generated/prisma/client.js";
import { recordEvent } from "../events/recordEvent.js";
import { logger } from "../../logger.js";

/**
 * How long a hand-off keeps agents silent after the person's last message. A
 * code constant on purpose: a mikro.json key that lands before its release
 * crashes the rollback (`.strict()` config).
 */
export const HANDOFF_TTL_MS = 24 * 60 * 60 * 1000;

export interface OpenHandoffInput {
  phone: string;
  /** The WhatsApp profile that was serving the person (GUEST, PROSPECT, …). */
  profile: string;
  reason: string;
  applicationId?: string;
  customerId?: string;
  /** Shown on the feed card; the customer's name or the applicant's name. */
  displayName?: string;
  /** 2–3 sentences from the agent that handed off, for the Chatwoot note. */
  summary?: string;
  /** Last turns (oldest first) for the note when no agent wrote a summary. */
  recentMessages?: Array<{ role: "user" | "assistant"; content: string }>;
}

/** Called once per NEW hand-off, after it is committed. Must not throw. */
export type OnHandoffOpened = (input: OpenHandoffInput) => Promise<unknown>;

type HandoffClient = Pick<PrismaClient, "conversationHandoff" | "businessEvent" | "$transaction">;

function openWhere(phone: string, now: Date) {
  return { phone, closedAt: null, expiresAt: { gt: now } };
}

/** When the phone's open hand-off expires, or null when none is open. */
export function createGetOpenHandoffExpiry(db: Pick<PrismaClient, "conversationHandoff">) {
  return async (phone: string): Promise<Date | null> => {
    const open = await db.conversationHandoff.findFirst({
      where: openWhere(phone, new Date()),
      orderBy: { expiresAt: "desc" },
      select: { expiresAt: true }
    });
    return open?.expiresAt ?? null;
  };
}

/**
 * Push an open hand-off's expiry out by the TTL (the person wrote again).
 * Returns whether a hand-off was open.
 */
export function createExtendHandoff(db: Pick<PrismaClient, "conversationHandoff">) {
  return async (phone: string): Promise<boolean> => {
    const now = new Date();
    const { count } = await db.conversationHandoff.updateMany({
      where: openWhere(phone, now),
      data: { expiresAt: new Date(now.getTime() + HANDOFF_TTL_MS) }
    });
    return count > 0;
  };
}

/**
 * Open a hand-off, or extend the one already open (no duplicates). A new
 * hand-off also appends the `cx.handoff_requested` feed event in the same
 * transaction. Returns whether a new hand-off was opened.
 */
export function createOpenHandoff(db: HandoffClient, onOpened?: OnHandoffOpened) {
  return async (input: OpenHandoffInput): Promise<{ opened: boolean }> => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + HANDOFF_TTL_MS);
    const opened = await db.$transaction(async (tx) => {
      const { count } = await tx.conversationHandoff.updateMany({
        where: openWhere(input.phone, now),
        data: { expiresAt }
      });
      if (count > 0) return false;
      const handoff = await tx.conversationHandoff.create({
        data: {
          phone: input.phone,
          profile: input.profile,
          reason: input.reason,
          applicationId: input.applicationId ?? null,
          customerId: input.customerId ?? null,
          expiresAt
        }
      });
      await recordEvent(tx, {
        type: "cx.handoff_requested",
        actorName: "WhatsApp",
        customerId: input.customerId,
        customerName: input.displayName,
        applicationId: input.applicationId,
        summary: `${input.displayName ?? input.phone} pidió hablar con una persona.`,
        payload: {
          handoffId: handoff.id,
          phone: input.phone,
          profile: input.profile,
          reason: input.reason
        }
      });
      return true;
    });
    logger.info(opened ? "human hand-off opened" : "human hand-off extended", {
      phone: input.phone,
      profile: input.profile
    });
    // Not awaited: the Chatwoot note retries its lookup for a few seconds and
    // must never hold up (or fail) the reply to the person.
    if (opened && onOpened) {
      void onOpened(input).catch((err: Error) =>
        logger.error("hand-off follow-up failed", { phone: input.phone, error: err.message })
      );
    }
    return { opened };
  };
}
