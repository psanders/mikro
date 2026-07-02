/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Watch-rule CRUD (design Decision 5). Rules are low-risk and reversible, so the
 * copilot creates and disables them directly. Every function validates its input
 * against the `@mikro/common` contract and throws the repo's structured
 * `ValidationError` on failure (no row written).
 */
import {
  ValidationError,
  createWatchRuleSchema,
  listWatchRulesSchema,
  setWatchRuleEnabledSchema
} from "@mikro/common";
import type { WatchRuleMetric } from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";

/** A watch rule as returned to the client / copilot. */
export interface WatchRuleView {
  id: string;
  name: string;
  metric: WatchRuleMetric;
  comparator: "gt" | "lt";
  threshold: number;
  collectorId: string | null;
  enabled: boolean;
  lastState: string | null;
  lastEvaluatedAt: Date | null;
  createdAt: Date;
}

interface WatchRuleRow {
  id: string;
  name: string;
  metric: string;
  comparator: string;
  threshold: number;
  collectorId: string | null;
  enabled: boolean;
  lastState: string | null;
  lastEvaluatedAt: Date | null;
  createdAt: Date;
}

function toView(row: WatchRuleRow): WatchRuleView {
  return {
    id: row.id,
    name: row.name,
    metric: row.metric as WatchRuleMetric,
    comparator: row.comparator as "gt" | "lt",
    threshold: row.threshold,
    collectorId: row.collectorId,
    enabled: row.enabled,
    lastState: row.lastState,
    lastEvaluatedAt: row.lastEvaluatedAt,
    createdAt: row.createdAt
  };
}

/**
 * Create a watch rule. `mora_pct_collector` additionally requires a
 * `collectorId` (which collector to watch).
 */
export async function createWatchRule(
  db: PrismaClient,
  rawInput: unknown,
  createdById: string
): Promise<WatchRuleView> {
  const parsed = createWatchRuleSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(parsed.error);
  }
  const input = parsed.data;

  if (input.metric === "mora_pct_collector" && !input.collectorId) {
    throw new Error(
      "La métrica mora_pct_collector requiere un collectorId (el cobrador a vigilar)."
    );
  }

  const row = await db.watchRule.create({
    data: {
      name: input.name,
      metric: input.metric,
      comparator: input.comparator,
      threshold: input.threshold,
      collectorId: input.collectorId ?? null,
      createdById
    }
  });

  return toView(row);
}

/** List watch rules (active only unless `includeDisabled` is set). */
export async function listWatchRules(
  db: PrismaClient,
  rawInput: unknown
): Promise<WatchRuleView[]> {
  const parsed = listWatchRulesSchema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    throw new ValidationError(parsed.error);
  }
  const includeDisabled = parsed.data.includeDisabled ?? false;

  const rows = await db.watchRule.findMany({
    where: includeDisabled ? {} : { enabled: true },
    orderBy: { createdAt: "desc" }
  });

  return rows.map(toView);
}

/** Enable or disable a watch rule. */
export async function setWatchRuleEnabled(
  db: PrismaClient,
  rawInput: unknown
): Promise<WatchRuleView> {
  const parsed = setWatchRuleEnabledSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(parsed.error);
  }

  const row = await db.watchRule.update({
    where: { id: parsed.data.id },
    data: { enabled: parsed.data.enabled }
  });

  return toView(row);
}

/** Disable a watch rule by id (copilot DIRECT tool convenience). */
export async function disableWatchRule(db: PrismaClient, id: string): Promise<WatchRuleView> {
  return setWatchRuleEnabled(db, { id, enabled: false });
}
