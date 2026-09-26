/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shapes for the conversation audit (openspec add-conversation-audit). The
 * apiserver loads stored turns and hand-offs into `AuditConversation`s; the
 * checks and the judge here turn them into `AuditFinding`s. No I/O here.
 */
import type { AgentPolicy } from "../llm/types.js";

export type AuditSeverity = "CRITICAL" | "WARNING";
export type AuditSource = "CODE" | "JUDGE";

/** One stored turn, as the audit sees it. */
export interface AuditTurn {
  id: number;
  role: "INBOUND" | "AGENT" | "SYSTEM";
  content: string;
  profile: string | null;
  agentName: string | null;
  agentVersion: string | null;
  /** Names of the tools the agent ran this turn. */
  toolNames: string[];
  applicationId: string | null;
  customerId: string | null;
  failed: boolean;
  createdAt: Date;
  /**
   * True for turns from before the reviewed window, loaded only so the judge
   * has context. Findings never cite them.
   */
  context?: boolean;
}

/** One phone's turns in (and just before) the reviewed window. */
export interface AuditConversation {
  phone: string;
  turns: AuditTurn[];
  /** When hand-offs were opened for this phone (any time). */
  handoffsOpenedAt: Date[];
}

export interface AuditFinding {
  phone: string;
  applicationId: string | null;
  customerId: string | null;
  profile: string | null;
  agentName: string | null;
  agentVersion: string | null;
  /** A code-check id (`failed_send`, …) or a policy id. */
  checkId: string;
  source: AuditSource;
  severity: AuditSeverity;
  /** Human-readable rule (check title or policy text). */
  rule: string;
  turnId: number | null;
  /** The cited text. */
  evidence: string | null;
  reason: string;
}

/** A policy verdict from the judge. */
export interface JudgeVerdict {
  policyId: string;
  pass: boolean;
  turnId?: number | null;
  evidence?: string | null;
  reason: string;
}

/** Grades one conversation against the serving agent's policies. */
export type JudgeConversation = (
  conversation: AuditConversation,
  agent: { name: string; policies: AgentPolicy[] }
) => Promise<JudgeVerdict[]>;
