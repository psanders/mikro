/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Cron-driven conversation audit (openspec add-conversation-audit). Runs on
 * `conversationAudit.schedule` in `timezone`, only while
 * `conversationAudit.enabled` is true. The copilot's on-demand run doesn't go
 * through here, so it works with the schedule off.
 */
import { Cron } from "croner";
import { getConfig, type ResolvedMikroConfig } from "@mikro/common";
import { AuditInProgressError } from "../api/conversations/index.js";
import { logger } from "../logger.js";

export interface CreateConversationAuditWorkerOptions {
  getConfigFn?: () => ResolvedMikroConfig;
}

/**
 * Starts the audit worker and returns a stop function (a no-op when the
 * audit is disabled). A tick that finds a run in progress skips quietly.
 */
export function createConversationAuditWorker(
  runAudit: (input: { trigger: "SCHEDULED"; actorName: string }) => Promise<unknown>,
  options?: CreateConversationAuditWorkerOptions
): () => void {
  const cfg = (options?.getConfigFn ?? getConfig)();
  const { enabled, schedule } = cfg.conversationAudit;

  if (!enabled) {
    logger.info("conversation audit worker disabled", { schedule });
    return () => {};
  }

  const job = new Cron(schedule, { timezone: cfg.timezone }, () => {
    runAudit({ trigger: "SCHEDULED", actorName: "Sistema" }).catch((err) => {
      if (err instanceof AuditInProgressError) {
        logger.info("conversation audit: skipped, a run is in progress");
        return;
      }
      logger.error("conversation audit: tick failed", { error: (err as Error).message });
    });
  });

  logger.info("conversation audit worker started", { schedule, timezone: cfg.timezone });

  return () => {
    job.stop();
    logger.info("conversation audit worker stopped");
  };
}
