/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { DbClient } from "@mikro/common";
import { logger } from "../logger.js";

/**
 * Restart a DRAFT's abandon clock. Every piece of prospect activity (an inbound
 * WhatsApp message, a partial form autosave) cancels the pending ABANDON job
 * and schedules a fresh one `abandonDelayMs` out, so a draft is abandoned only
 * after that long with no word from the prospect (openspec cx-role-based-agents).
 * Keeps at most one PENDING ABANDON per application.
 */
export function createRecordProspectActivity(client: DbClient, abandonDelayMs: number) {
  return async (applicationId: string): Promise<void> => {
    await client.followUpJob.updateMany({
      where: { applicationId, status: "PENDING", type: "ABANDON" },
      data: { status: "CANCELLED" }
    });
    const scheduledFor = new Date(Date.now() + abandonDelayMs);
    await client.followUpJob.create({
      data: { applicationId, type: "ABANDON", scheduledFor }
    });
    logger.verbose("prospect activity — ABANDON rescheduled", { applicationId, scheduledFor });
  };
}
