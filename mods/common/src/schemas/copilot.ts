/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";

/**
 * Metrics a watch rule can observe in v1 — limited to what is computable from
 * current business data. Extending this enum is how new rules become possible.
 */
export const watchRuleMetricEnum = z.enum([
  "mora_pct_portfolio",
  "mora_pct_collector",
  "cobranza_diaria"
]);

export type WatchRuleMetric = z.infer<typeof watchRuleMetricEnum>;

export const watchRuleComparatorEnum = z.enum(["gt", "lt"]);

export const createWatchRuleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  metric: watchRuleMetricEnum,
  comparator: watchRuleComparatorEnum,
  threshold: z.number().finite(),
  // Required when metric is collector-scoped (mora_pct_collector).
  collectorId: z.uuid().optional()
});

export type CreateWatchRuleInput = z.infer<typeof createWatchRuleSchema>;

export const listWatchRulesSchema = z.object({
  includeDisabled: z.boolean().optional()
});

export const setWatchRuleEnabledSchema = z.object({
  id: z.uuid(),
  enabled: z.boolean()
});

export const copilotChatSchema = z.object({
  message: z.string().trim().min(1).max(4000)
});

export const copilotActionDecisionSchema = z.object({
  actionId: z.uuid()
});

export const getCopilotHistorySchema = z.object({
  limit: z.number().int().positive().max(100).optional()
});

export const clearCopilotHistorySchema = z.object({});

export const clearCopilotHistoryResultSchema = z.object({
  cleared: z.number().int().nonnegative()
});

export type ClearCopilotHistoryResult = z.infer<typeof clearCopilotHistoryResultSchema>;

/** Minutes a pending copilot action stays confirmable. */
export const COPILOT_ACTION_EXPIRY_MINUTES = 15;

export const copilotPendingActionStatusEnum = z.enum([
  "PENDING",
  "CONFIRMED",
  "REJECTED",
  "EXPIRED"
]);

/**
 * A write proposed by the copilot, awaiting the founder's decision. `summary`
 * is the human Spanish one-liner shown on the confirm card; `args` are shown
 * verbatim so the founder sees exactly what would execute.
 */
export const copilotPendingActionSchema = z.object({
  id: z.uuid(),
  toolName: z.string(),
  args: z.record(z.string(), z.unknown()),
  summary: z.string(),
  status: copilotPendingActionStatusEnum,
  createdAt: z.coerce.date()
});

export type CopilotPendingAction = z.infer<typeof copilotPendingActionSchema>;

/** Tool provenance attached to an assistant reply ("Mikro API · <tool> · <ms>"). */
export const copilotProvenanceSchema = z.object({
  tools: z.array(z.string()),
  elapsedMs: z.number().int().nonnegative()
});

export type CopilotProvenance = z.infer<typeof copilotProvenanceSchema>;

/**
 * One copilotChat response: the assistant's reply text, optional provenance,
 * and — when the model proposed a write — the pending action to confirm.
 * Rule cards render when `createdRule` is present (Vigilar creates directly).
 */
export const copilotChatReplySchema = z.object({
  reply: z.string(),
  provenance: copilotProvenanceSchema.optional(),
  pendingAction: copilotPendingActionSchema.optional(),
  createdRule: z
    .object({
      id: z.uuid(),
      name: z.string(),
      metric: watchRuleMetricEnum,
      comparator: watchRuleComparatorEnum,
      threshold: z.number(),
      collectorId: z.uuid().nullable().optional()
    })
    .optional()
});

export type CopilotChatReply = z.infer<typeof copilotChatReplySchema>;
