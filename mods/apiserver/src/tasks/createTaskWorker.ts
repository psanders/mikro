/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Interval worker that fires due founder tasks — same lifecycle shape as the
 * watch-rule evaluator: created at apiserver startup, returns a stop function
 * wired into SIGTERM/SIGINT. The pass itself lives in `processDueTasks` so it
 * can be unit-tested without a timer.
 */
import type { PrismaClient } from "../generated/prisma/client.js";
import { logger } from "../logger.js";
import { processDueTasks } from "./processDueTasks.js";

/** Default cadence: every minute (schedules are minute-granular). */
const DEFAULT_INTERVAL_MS = 60 * 1000;

export interface TaskWorkerOptions {
  intervalMs?: number;
}

export function createTaskWorker(db: PrismaClient, options?: TaskWorkerOptions): () => void {
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;

  async function tick(): Promise<void> {
    try {
      const result = await processDueTasks(db);
      if (result.fired > 0) {
        logger.info("task worker: fired tasks", result);
      }
    } catch (error) {
      logger.error("task worker: tick failed", { error: (error as Error).message });
    }
  }

  const handle = setInterval(() => {
    tick().catch((err) => {
      logger.error("task worker: tick failed", { error: (err as Error).message });
    });
  }, intervalMs);

  // Don't keep the process alive solely for this timer.
  if (typeof handle.unref === "function") handle.unref();

  logger.info("task worker started", { intervalMs });

  return () => {
    clearInterval(handle);
    logger.info("task worker stopped");
  };
}
