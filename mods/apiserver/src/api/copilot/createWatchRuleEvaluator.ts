/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Interval worker that periodically evaluates the watch rules (design Decision
 * 5), same lifecycle shape as the QCobro worker: created at apiserver startup,
 * returns a stop function wired into SIGTERM/SIGINT. The pass itself lives in
 * `evaluateWatchRules` so it can be unit-tested without a timer.
 */
import type { PrismaClient } from "../../generated/prisma/client.js";
import { logger } from "../../logger.js";
import { evaluateWatchRules } from "./evaluateWatchRules.js";

/** Default cadence: every 5 minutes. */
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

export interface WatchRuleEvaluatorOptions {
  /** Override the evaluation cadence (ms). */
  intervalMs?: number;
}

/**
 * Start the watch-rule evaluator on an interval. Returns a stop function.
 */
export function createWatchRuleEvaluator(
  db: PrismaClient,
  options?: WatchRuleEvaluatorOptions
): () => void {
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;

  async function tick(): Promise<void> {
    try {
      const result = await evaluateWatchRules(db);
      if (result.alerts > 0) {
        logger.info("watch rule evaluator: alerts recorded", {
          evaluated: result.evaluated,
          alerts: result.alerts
        });
      }
    } catch (error) {
      logger.error("watch rule evaluator: tick failed", { error: (error as Error).message });
    }
  }

  const handle = setInterval(() => {
    tick().catch((err) => {
      logger.error("watch rule evaluator: tick failed", { error: (err as Error).message });
    });
  }, intervalMs);

  // Don't keep the process alive solely for this timer.
  if (typeof handle.unref === "function") handle.unref();

  logger.info("watch rule evaluator started", { intervalMs });

  return () => {
    clearInterval(handle);
    logger.info("watch rule evaluator stopped");
  };
}
