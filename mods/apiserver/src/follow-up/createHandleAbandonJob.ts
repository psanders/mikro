/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { DbClient, FollowUpJob } from "@mikro/common";
import { logger } from "../logger.js";

export function createHandleAbandonJob(client: DbClient) {
  return async (job: FollowUpJob): Promise<void> => {
    const app = await client.loanApplication.findUnique({ where: { id: job.applicationId } });

    if (!app || app.status !== "RECEIVED") {
      await client.followUpJob.update({ where: { id: job.id }, data: { status: "CANCELLED" } });
      logger.verbose("ABANDON cancelled — application not in RECEIVED", {
        jobId: job.id,
        applicationId: job.applicationId,
        status: app?.status ?? "NOT_FOUND"
      });
      return;
    }

    await client.loanApplication.update({
      where: { id: app.id },
      data: { status: "ABANDONED" }
    });
    await client.followUpJob.update({ where: { id: job.id }, data: { status: "DONE" } });
    logger.info("application auto-abandoned after stale window", { applicationId: app.id });
  };
}
