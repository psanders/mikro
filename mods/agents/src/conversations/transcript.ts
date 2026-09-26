/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * WhatsApp CX transcripts (issue #299). Every message between a guest,
 * prospect, applicant or customer and the app is persisted by the apiserver
 * through `recordConversationTurn`, and the agents read their memory back
 * through `getConversationHistory` — so a conversation survives a restart and
 * can be audited or replayed against a newer agent to catch drift.
 */
import { createHash } from "node:crypto";
import type { Agent, Message, ToolExecuted } from "../llm/types.js";
import type { Profile } from "../constants.js";

/** INBOUND: the person. AGENT: an LLM agent's reply. SYSTEM: a fixed app reply. */
export type ConversationTurnRole = "INBOUND" | "AGENT" | "SYSTEM";

export interface ConversationTurnRecord {
  /** E.164, as the router normalizes it. */
  phone: string;
  role: ConversationTurnRole;
  content: string;
  profile?: Profile;
  agentName?: string;
  agentVersion?: string;
  /** Tools the agent ran this turn: name and arguments only. */
  toolCalls?: ToolExecuted[];
  hasImage?: boolean;
  applicationId?: string;
  customerId?: string;
  /** The inbound message's wamid, or the one Meta returned for our send. */
  waMessageId?: string;
}

/**
 * Which part of a phone's transcript an agent remembers. `cx` is the
 * guest/applicant/customer conversation (one thread per phone, as before);
 * `prospect` is José's intake for one application.
 */
export type ConversationHistoryQuery =
  | { phone: string; scope: "cx"; excludeId?: string }
  | { phone: string; scope: "prospect"; applicationId: string; excludeId?: string };

/**
 * A short, stable fingerprint of what shapes an agent's behavior: prompt,
 * model, temperature, reply mode and tools. Stored on each AGENT turn so evals
 * can compare conversations across agent revisions.
 */
export function agentVersionOf(agent: Agent): string {
  const shape = JSON.stringify({
    systemPrompt: agent.systemPrompt,
    model: agent.model ?? null,
    temperature: agent.temperature ?? null,
    replyMode: agent.replyMode ?? null,
    allowedTools: [...(agent.allowedTools ?? [])].sort()
  });
  return createHash("sha256").update(shape).digest("hex").slice(0, 12);
}

/** Text of a history message (image parts dropped). */
export function textOf(message: Message): string {
  if (typeof message.content === "string") return message.content;
  return message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n");
}
