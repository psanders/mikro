/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { DbClient } from "@mikro/common";
import type { NudgeResult } from "./createSendFollowUpNudge.js";
import { createHandleNudgeJob } from "./createHandleNudgeJob.js";
import { createHandleAbandonJob } from "./createHandleAbandonJob.js";
import { logger } from "../logger.js";

const POLL_INTERVAL_MS = 30_000;

interface Deps {
  client: DbClient;
  sendFollowUpNudge: (phone: string) => Promise<NudgeResult>;
  abandonDelayMs: number;
}

export function createFollowUpWorker({
  client,
  sendFollowUpNudge,
  abandonDelayMs
}: Deps): () => void {
  const handleNudgeJob = createHandleNudgeJob({ client, sendFollowUpNudge, abandonDelayMs });
  const handleAbandonJob = createHandleAbandonJob(client);

  async function tick(): Promise<void> {
    const now = new Date();
    let jobs;
    try {
      jobs = await client.followUpJob.findMany({
        where: { status: "PENDING", scheduledFor: { lte: now } }
      });
    } catch (err) {
      logger.error("follow-up worker: failed to query jobs", {
        error: (err as Error).message
      });
      return;
    }

    for (const job of jobs) {
      try {
        if (job.type === "NUDGE") {
          await handleNudgeJob(job);
        } else {
          await handleAbandonJob(job);
        }
      } catch (err) {
        logger.error("follow-up worker: job handler threw", {
          jobId: job.id,
          type: job.type,
          error: (err as Error).message
        });
      }
    }
  }

  const interval = setInterval(() => {
    tick().catch((err) => {
      logger.error("follow-up worker: tick failed", { error: (err as Error).message });
    });
  }, POLL_INTERVAL_MS);

  logger.info("follow-up worker started", { pollIntervalMs: POLL_INTERVAL_MS });

  return () => {
    clearInterval(interval);
    logger.info("follow-up worker stopped");
  };
}
