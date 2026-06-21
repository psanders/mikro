/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { DbClient } from "@mikro/common";
import { logger } from "../logger.js";

const NUDGE_DELAY_MS = 10 * 60 * 1000; // 10 minutes

export function createScheduleFollowUpJob(client: DbClient) {
  return async (applicationId: string): Promise<void> => {
    const scheduledFor = new Date(Date.now() + NUDGE_DELAY_MS);
    await client.followUpJob.create({
      data: { applicationId, type: "NUDGE", scheduledFor }
    });
    logger.verbose("follow-up NUDGE job scheduled", { applicationId, scheduledFor });
  };
}
