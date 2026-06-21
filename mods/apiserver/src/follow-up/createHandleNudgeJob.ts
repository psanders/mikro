/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { DbClient, FollowUpJob } from "@mikro/common";
import type { NudgeResult } from "./createSendFollowUpNudge.js";
import { logger } from "../logger.js";

interface Deps {
  client: DbClient;
  sendFollowUpNudge: (phone: string, firstName?: string | null) => Promise<NudgeResult>;
  abandonDelayMs: number;
}

export function createHandleNudgeJob({ client, sendFollowUpNudge, abandonDelayMs }: Deps) {
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
      logger.verbose("NUDGE skipped — no phone; scheduling immediate ABANDON", {
        applicationId: app.id
      });
    }

    const abandonDelay = app.phone ? abandonDelayMs : 0;
    const scheduledFor = new Date(Date.now() + abandonDelay);
    await client.followUpJob.create({
      data: { applicationId: app.id, type: "ABANDON", scheduledFor }
    });

    await client.followUpJob.update({ where: { id: job.id }, data: { status: "DONE" } });
    logger.verbose("NUDGE handled — ABANDON job scheduled", {
      applicationId: app.id,
      scheduledFor,
      hadPhone: !!app.phone
    });
  };
}
