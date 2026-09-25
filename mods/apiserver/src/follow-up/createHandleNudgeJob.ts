/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { DbClient, FollowUpJob } from "@mikro/common";
import type { NudgeResult } from "./createSendFollowUpNudge.js";
import { logger } from "../logger.js";

interface Deps {
  client: DbClient;
  sendFollowUpNudge: (phone: string, firstName?: string | null) => Promise<NudgeResult>;
}

/**
 * NUDGE fires a while after an application is submitted. It only sends the
 * template: a submitted application is never abandoned by a timer, so there is
 * no ABANDON to schedule here (DRAFT abandon follows the prospect's last
 * activity — see createRecordProspectActivity).
 */
export function createHandleNudgeJob({ client, sendFollowUpNudge }: Deps) {
  return async (job: FollowUpJob): Promise<void> => {
    const app = await client.loanApplication.findUnique({ where: { id: job.applicationId } });

    if (!app || app.status !== "RECEIVED") {
      await client.followUpJob.update({ where: { id: job.id }, data: { status: "CANCELLED" } });
      logger.verbose("NUDGE cancelled — application not in RECEIVED", {
        jobId: job.id,
        applicationId: job.applicationId,
        status: app?.status ?? "NOT_FOUND"
      });
      return;
    }

    if (app.phone) {
      await sendFollowUpNudge(app.phone, app.firstName);
    } else {
      logger.verbose("NUDGE skipped — no phone", { applicationId: app.id });
    }

    await client.followUpJob.update({ where: { id: job.id }, data: { status: "DONE" } });
    logger.verbose("NUDGE handled", { applicationId: app.id, hadPhone: !!app.phone });
  };
}
