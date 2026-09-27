/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Conversation audit (openspec add-conversation-audit): a scheduled or
 * on-demand review of stored CX WhatsApp turns. Code checks plus an AI rules
 * judge produce findings; each run posts a `conversation.audited` feed event.
 */
import { z } from "zod/v4";

export const conversationAuditTriggerEnum = z.enum(["SCHEDULED", "MANUAL"]);
export const conversationAuditStatusEnum = z.enum(["RUNNING", "DONE", "FAILED"]);
export const conversationAuditSeverityEnum = z.enum(["CRITICAL", "WARNING"]);
export const conversationAuditSourceEnum = z.enum(["CODE", "JUDGE"]);

/** One agent's line in a run: its version then, and what the run found for it. */
export const conversationAuditAgentSummarySchema = z.object({
  agentName: z.string().min(1),
  profile: z.string().nullable(),
  agentVersion: z.string().nullable(),
  /** The version differs from this agent's version in the previous run. */
  isNewVersion: z.boolean().optional(),
  conversations: z.number().int().nonnegative(),
  critical: z.number().int().nonnegative(),
  warning: z.number().int().nonnegative()
});

/** The worst finding of a run, denormalized so the feed card renders alone. */
export const conversationAuditTopFindingSchema = z.object({
  severity: conversationAuditSeverityEnum,
  rule: z.string().min(1),
  agentName: z.string().nullable(),
  personLabel: z.string().min(1),
  quote: z.string().nullable(),
  applicationId: z.string().nullable(),
  turnAt: z.string().nullable()
});

/** Payload of the `conversation.audited` feed event. */
export const conversationAuditedPayloadSchema = z.object({
  runId: z.string().min(1),
  trigger: conversationAuditTriggerEnum,
  conversations: z.number().int().nonnegative(),
  turns: z.number().int().nonnegative(),
  handoffs: z.number().int().nonnegative(),
  failedSends: z.number().int().nonnegative(),
  /** Conversations with at least one finding (the card's "N de M no cumplen"). */
  flaggedConversations: z.number().int().nonnegative(),
  /** The run's verdict in words, shown on the card (AI-written, template fallback). */
  statusText: z.string().min(1),
  criticalCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  judged: z.number().int().nonnegative(),
  judgeSkipped: z.number().int().nonnegative(),
  judgeErrors: z.number().int().nonnegative(),
  /** ISO start of the reviewed window (first turn reviewed), null when empty. */
  windowStart: z.string().nullable(),
  byAgent: z.array(conversationAuditAgentSummarySchema),
  topFinding: conversationAuditTopFindingSchema.nullable()
});

/** Start a run (copilot / scheduler). */
export const runConversationAuditSchema = z.object({
  trigger: conversationAuditTriggerEnum,
  actorName: z.string().min(1)
});

/** Findings of one run, for the detail panel. */
export const listConversationAuditFindingsSchema = z.object({
  runId: z.string().min(1, "Run ID is required")
});

export type ConversationAuditTrigger = z.infer<typeof conversationAuditTriggerEnum>;
export type ConversationAuditStatus = z.infer<typeof conversationAuditStatusEnum>;
export type ConversationAuditSeverity = z.infer<typeof conversationAuditSeverityEnum>;
export type ConversationAuditSource = z.infer<typeof conversationAuditSourceEnum>;
export type ConversationAuditAgentSummary = z.infer<typeof conversationAuditAgentSummarySchema>;
export type ConversationAuditTopFinding = z.infer<typeof conversationAuditTopFindingSchema>;
export type ConversationAuditedPayload = z.infer<typeof conversationAuditedPayloadSchema>;
export type RunConversationAuditInput = z.infer<typeof runConversationAuditSchema>;
export type ListConversationAuditFindingsInput = z.infer<
  typeof listConversationAuditFindingsSchema
>;
