/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Orchestrates one audit over already-loaded conversations: code checks on
 * every conversation, the rules judge on the most recently active ones up to
 * `maxConversations`, then counts and the per-agent breakdown. Pure apart
 * from the injected judge, so the apiserver owns loading and persistence.
 */
import type { AgentPolicy } from "../llm/types.js";
import { logger } from "../logger.js";
import { runChecks, subjectOf } from "./checks.js";
import type { AuditConversation, AuditFinding, AuditTurn, JudgeConversation } from "./types.js";

/** How many judge calls run at once. */
const JUDGE_CONCURRENCY = 3;

export interface RunAuditInput {
  conversations: AuditConversation[];
  /** The policies of an agent by its name (as stored on turns), if any. */
  getAgent: (agentName: string) => { name: string; policies: AgentPolicy[] } | undefined;
  maxConversations: number;
  judge: JudgeConversation;
  /** Each agent's `agent_version` in the previous run, to mark new versions. */
  previousVersions?: Record<string, string | null>;
}

export interface AuditAgentSummary {
  agentName: string;
  profile: string | null;
  agentVersion: string | null;
  isNewVersion: boolean;
  conversations: number;
  critical: number;
  warning: number;
}

export interface RunAuditResult {
  findings: AuditFinding[];
  conversations: number;
  turns: number;
  failedSends: number;
  judged: number;
  judgeSkipped: number;
  judgeErrors: number;
  criticalCount: number;
  warningCount: number;
  byAgent: AuditAgentSummary[];
}

const reviewed = (c: AuditConversation) => c.turns.filter((t) => !t.context);
const lastActivity = (c: AuditConversation) =>
  Math.max(0, ...reviewed(c).map((t) => t.createdAt.getTime()));

/** Agents that wrote in the reviewed part of a conversation, in order of appearance. */
function agentsIn(c: AuditConversation): string[] {
  return [
    ...new Set(
      reviewed(c)
        .filter((t) => t.role === "AGENT" && t.agentName)
        .map((t) => t.agentName!)
    )
  ];
}

/** The agent that served the reviewed part of a conversation, if any. */
function servingAgent(c: AuditConversation): AuditTurn | undefined {
  return [...reviewed(c)].reverse().find((t) => t.role === "AGENT" && t.agentName);
}

/** The agent's latest turn in the reviewed part of a conversation. */
function lastTurnBy(c: AuditConversation, agentName: string): AuditTurn | undefined {
  return [...reviewed(c)].reverse().find((t) => t.role === "AGENT" && t.agentName === agentName);
}

async function judgeOne(
  conversation: AuditConversation,
  agent: { name: string; policies: AgentPolicy[] },
  judge: JudgeConversation
): Promise<AuditFinding[]> {
  const verdicts = await judge(conversation, agent);
  const windowTurns = new Map(reviewed(conversation).map((t) => [t.id, t]));
  const subject = subjectOf(conversation);
  const findings: AuditFinding[] = [];
  for (const verdict of verdicts) {
    if (verdict.pass) continue;
    const policy = agent.policies.find((p) => p.id === verdict.policyId);
    if (!policy) continue;
    // A cited turn outside the window (context, or made up) isn't this run's to report.
    const turn = verdict.turnId != null ? windowTurns.get(verdict.turnId) : undefined;
    // These are this agent's rules: a cited message from another agent isn't its violation.
    if (turn?.role === "AGENT" && turn.agentName && turn.agentName !== agent.name) continue;
    const own = turn?.agentName === agent.name ? turn : lastTurnBy(conversation, agent.name);
    findings.push({
      phone: conversation.phone,
      applicationId: turn?.applicationId ?? subject.applicationId,
      customerId: turn?.customerId ?? subject.customerId,
      profile: own?.profile ?? turn?.profile ?? null,
      agentName: agent.name,
      agentVersion: own?.agentVersion ?? null,
      checkId: policy.id,
      source: "JUDGE",
      severity: policy.severity === "critical" ? "CRITICAL" : "WARNING",
      rule: policy.rule,
      turnId: turn?.id ?? null,
      evidence: verdict.evidence ?? turn?.content ?? null,
      reason: verdict.reason
    });
  }
  return findings;
}

export async function runAudit(input: RunAuditInput): Promise<RunAuditResult> {
  const conversations = input.conversations.filter((c) => reviewed(c).length > 0);
  const findings: AuditFinding[] = conversations.flatMap((c) => runChecks(c));

  // Judge the most recently active conversations first, up to the cap. Each
  // agent that wrote in a conversation is judged against its own rules (a
  // conversation José started and Sofía continued gets both).
  const judgeable = conversations
    .filter((c) => agentsIn(c).some((name) => (input.getAgent(name)?.policies.length ?? 0) > 0))
    .sort((a, b) => lastActivity(b) - lastActivity(a));
  const toJudge = judgeable.slice(0, Math.max(0, input.maxConversations)).flatMap((conversation) =>
    agentsIn(conversation)
      .map((name) => input.getAgent(name))
      .filter(
        (agent): agent is { name: string; policies: AgentPolicy[] } =>
          !!agent && agent.policies.length > 0
      )
      .map((agent) => ({ conversation, agent }))
  );
  const judgeSkipped =
    judgeable.length - Math.min(judgeable.length, Math.max(0, input.maxConversations));

  let judgeErrors = 0;
  const judgedConversations = new Set<AuditConversation>();
  for (let i = 0; i < toJudge.length; i += JUDGE_CONCURRENCY) {
    const batch = toJudge.slice(i, i + JUDGE_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(({ conversation, agent }) => judgeOne(conversation, agent, input.judge))
    );
    results.forEach((r, j) => {
      if (r.status === "fulfilled") {
        findings.push(...r.value);
        judgedConversations.add(batch[j]!.conversation);
      } else {
        judgeErrors += 1;
        logger.warn("conversation audit: judge failed", {
          phone: batch[j]!.conversation.phone,
          agent: batch[j]!.agent.name,
          error: (r.reason as Error)?.message
        });
      }
    });
  }

  // Per-agent breakdown: conversations by serving agent, findings by attributed agent.
  const summaries = new Map<string, AuditAgentSummary>();
  const summaryFor = (name: string, from?: Partial<AuditTurn>) => {
    let s = summaries.get(name);
    if (!s) {
      const version = from?.agentVersion ?? null;
      const previous = input.previousVersions?.[name];
      s = {
        agentName: name,
        profile: from?.profile ?? null,
        agentVersion: version,
        isNewVersion: previous !== undefined && previous !== version,
        conversations: 0,
        critical: 0,
        warning: 0
      };
      summaries.set(name, s);
    }
    return s;
  };
  for (const c of conversations) {
    const served = servingAgent(c);
    if (served?.agentName) summaryFor(served.agentName, served).conversations += 1;
  }
  for (const f of findings) {
    if (!f.agentName) continue;
    const s = summaryFor(f.agentName, f);
    if (f.severity === "CRITICAL") s.critical += 1;
    else s.warning += 1;
  }

  const allReviewed = conversations.flatMap(reviewed);
  return {
    findings,
    conversations: conversations.length,
    turns: allReviewed.length,
    failedSends: allReviewed.filter((t) => t.role !== "INBOUND" && t.failed).length,
    judged: judgedConversations.size,
    judgeSkipped,
    judgeErrors,
    criticalCount: findings.filter((f) => f.severity === "CRITICAL").length,
    warningCount: findings.filter((f) => f.severity === "WARNING").length,
    byAgent: [...summaries.values()].sort(
      (a, b) =>
        b.critical - a.critical || b.warning - a.warning || b.conversations - a.conversations
    )
  };
}
