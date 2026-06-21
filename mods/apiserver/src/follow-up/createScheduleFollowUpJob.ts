/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { DbClient } from "@mikro/common";
import { logger } from "../logger.js";

export function createScheduleFollowUpJob(client: DbClient, nudgeDelayMs: number) {
  return async (applicationId: string): Promise<void> => {
    const scheduledFor = new Date(Date.now() + nudgeDelayMs);
    await client.followUpJob.create({
      data: { applicationId, type: "NUDGE", scheduledFor }
    });
    logger.verbose("follow-up NUDGE job scheduled", { applicationId, scheduledFor });
  };
}
