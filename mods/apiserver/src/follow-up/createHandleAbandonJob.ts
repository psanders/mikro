/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { DbClient, FollowUpJob } from "@mikro/common";
import { logger } from "../logger.js";

/**
 * ABANDON fires after the nudge window. Only a DRAFT is ever abandoned by a
 * timer: a submitted application (RECEIVED or later) stays in the reviewers'
 * queue until a person acts on it (openspec add-application-review-flow).
 */
export function createHandleAbandonJob(client: DbClient) {
  return async (job: FollowUpJob): Promise<void> => {
    const app = await client.loanApplication.findUnique({ where: { id: job.applicationId } });

    if (!app || app.status !== "DRAFT") {
      await client.followUpJob.update({ where: { id: job.id }, data: { status: "CANCELLED" } });
      logger.verbose("ABANDON cancelled — application is not a DRAFT", {
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
