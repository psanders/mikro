/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { DbClient, FollowUpJob } from "@mikro/common";
import { logger } from "../logger.js";

interface Options {
  /**
   * When the prospect's phone has an open human hand-off, its expiry. The
   * draft is not abandoned while a person is handling the conversation; the
   * job moves to the hand-off's expiry instead.
   */
  getOpenHandoffExpiry?: (phone: string) => Promise<Date | null>;
}

/**
 * ABANDON fires after the prospect's last activity plus the stale window. Only
 * a DRAFT is ever abandoned by a timer: a submitted application (RECEIVED or
 * later) stays in the reviewers' queue until a person acts on it (openspec
 * add-application-review-flow).
 */
export function createHandleAbandonJob(client: DbClient, options: Options = {}) {
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

    const handoffExpiry =
      app.phone && options.getOpenHandoffExpiry
        ? await options.getOpenHandoffExpiry(app.phone)
        : null;
    if (handoffExpiry) {
      await client.followUpJob.update({ where: { id: job.id }, data: { status: "CANCELLED" } });
      await client.followUpJob.create({
        data: { applicationId: app.id, type: "ABANDON", scheduledFor: handoffExpiry }
      });
      logger.verbose("ABANDON deferred — human hand-off open", {
        applicationId: app.id,
        scheduledFor: handoffExpiry
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
