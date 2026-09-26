/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Persisted WhatsApp CX transcripts (issue #299): one row per message between
 * a guest, prospect, applicant or customer and the app. Read back as the
 * agents' conversation memory, shown on the application panel, and exported
 * through ctl for agent evals.
 */
import { z } from "zod/v4";
import { profileEnum } from "./user.js";

/**
 * Who a turn came from. INBOUND is the person; AGENT is an LLM agent's reply;
 * SYSTEM is a fixed reply the app sent (hand-off acks, voice-note notices,
 * error messages).
 */
export const conversationTurnRoleEnum = z.enum(["INBOUND", "AGENT", "SYSTEM"]);

/** A tool an agent ran during a turn: its name and arguments, never its result. */
export const conversationToolCallSchema = z.object({
  name: z.string().min(1),
  args: z.record(z.string(), z.unknown())
});

export const recordConversationTurnSchema = z.object({
  phone: z.string().min(1, "Phone is required"),
  role: conversationTurnRoleEnum,
  content: z.string(),
  profile: profileEnum.optional(),
  agentName: z.string().optional(),
  agentVersion: z.string().optional(),
  toolCalls: z.array(conversationToolCallSchema).optional(),
  hasImage: z.boolean().optional(),
  applicationId: z.string().optional(),
  customerId: z.string().optional(),
  waMessageId: z.string().optional()
});

/**
 * Filters for listing turns (ctl export). Every filter is optional; with none,
 * the newest `limit` turns are returned. Results are always oldest first.
 */
export const listConversationTurnsSchema = z.object({
  phone: z.string().min(1).optional(),
  applicationId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  profile: profileEnum.optional(),
  agentName: z.string().min(1).optional(),
  agentVersion: z.string().min(1).optional(),
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
  limit: z.number().int().positive().max(10_000).default(1000)
});

export const getApplicationConversationSchema = z.object({
  applicationId: z.string().min(1, "Application ID is required")
});

export const deleteConversationSchema = z.object({
  phone: z.string().min(1, "Phone is required")
});

export type ConversationTurnRole = z.infer<typeof conversationTurnRoleEnum>;
export type ConversationToolCall = z.infer<typeof conversationToolCallSchema>;
export type RecordConversationTurnInput = z.infer<typeof recordConversationTurnSchema>;
export type ListConversationTurnsInput = z.input<typeof listConversationTurnsSchema>;
export type GetApplicationConversationInput = z.infer<typeof getApplicationConversationSchema>;
export type DeleteConversationInput = z.infer<typeof deleteConversationSchema>;
