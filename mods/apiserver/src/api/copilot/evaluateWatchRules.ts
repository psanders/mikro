/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * One evaluation pass over the enabled watch rules (design Decision 5). For each
 * rule it recomputes the metric, decides breached/ok, and records a `rule.alert`
 * business event ONLY on an ok→breached transition — `lastState` is the
 * anti-spam latch, so a rule that stays breached across passes alerts once, and
 * a rule that recovers and breaches again alerts again. `lastEvaluatedAt` is
 * always refreshed. Disabled rules are never loaded.
 */
import type { WatchRuleMetric } from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { recordEvent } from "../events/recordEvent.js";
import { logger } from "../../logger.js";
import { computeWatchMetric, isBreached } from "./metrics.js";

export interface EvaluateWatchRulesResult {
  evaluated: number;
  alerts: number;
}

function roundValue(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Evaluate all enabled watch rules once.
 *
 * @param db - Prisma client
 * @param asOf - Evaluation instant (defaults to now); injectable for tests
 */
export async function evaluateWatchRules(
  db: PrismaClient,
  asOf: Date = new Date()
): Promise<EvaluateWatchRulesResult> {
  const rules = await db.watchRule.findMany({ where: { enabled: true } });

  let alerts = 0;
  for (const rule of rules) {
    let value: number;
    try {
      value = await computeWatchMetric(
        db,
        { metric: rule.metric as WatchRuleMetric, collectorId: rule.collectorId },
        asOf
      );
    } catch (error) {
      logger.error("watch rule evaluation failed", {
        ruleId: rule.id,
        metric: rule.metric,
        error: (error as Error).message
      });
      continue;
    }

    const breached = isBreached(value, rule.comparator, rule.threshold);
    const newState = breached ? "breached" : "ok";

    if (breached && rule.lastState !== "breached") {
      const rounded = roundValue(value);
      await recordEvent(db, {
        type: "rule.alert",
        actorName: "Sistema",
        summary: `La regla "${rule.name}" se activó: ${rule.metric} = ${rounded} (umbral ${rule.comparator} ${rule.threshold}).`,
        payload: {
          ruleId: rule.id,
          ruleName: rule.name,
          metric: rule.metric,
          value: rounded,
          threshold: rule.threshold
        }
      });
      alerts += 1;
    }

    await db.watchRule.update({
      where: { id: rule.id },
      data: { lastState: newState, lastEvaluatedAt: asOf }
    });
  }

  return { evaluated: rules.length, alerts };
}
