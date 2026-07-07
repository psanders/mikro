/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { WhatsAppStatus } from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { logger } from "../../logger.js";

/**
 * Progress rank for delivery states. A later webhook must not downgrade the row
 * (Meta can deliver `sent`/`delivered`/`read` out of order). `failed` is terminal
 * and always wins over the progress states.
 */
const RANK: Record<string, number> = {
  accepted: 0,
  sent: 1,
  delivered: 2,
  read: 3
};

/**
 * Applies a `statuses` webhook entry to the matching `outbound_messages` row
 * (keyed by `waMessageId`). Ignored when no row matches (e.g. a Chatwoot-sent
 * message, or a send we don't track). Monotonic: never downgrades a progress
 * state; `failed` overrides. Best-effort — never throws.
 */
export function createUpdateOutboundStatus(db: PrismaClient) {
  return async (status: WhatsAppStatus): Promise<void> => {
    try {
      const row = await db.outboundMessage.findUnique({
        where: { waMessageId: status.id }
      });
      if (!row) {
        logger.verbose("status webhook for untracked message, ignoring", {
          waMessageId: status.id,
          status: status.status
        });
        return;
      }

      // Never move backwards through the progress states; `failed` always applies.
      if (row.status !== "failed" && status.status !== "failed") {
        if ((RANK[status.status] ?? 0) <= (RANK[row.status] ?? 0)) return;
      }
      // A row already failed stays failed.
      if (row.status === "failed") return;

      const error = status.errors?.[0];
      await db.outboundMessage.update({
        where: { waMessageId: status.id },
        data: {
          status: status.status,
          errorCode: error?.code ?? null,
          errorTitle: error?.title ?? error?.message ?? null
        }
      });
      logger.verbose("outbound message status updated", {
        waMessageId: status.id,
        status: status.status,
        errorCode: error?.code
      });
    } catch (err) {
      logger.error("failed to update outbound message status", {
        waMessageId: status.id,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  };
}

export type UpdateOutboundStatusFn = ReturnType<typeof createUpdateOutboundStatus>;
