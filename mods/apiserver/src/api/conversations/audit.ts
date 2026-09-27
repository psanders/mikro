/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Conversation audit (openspec add-conversation-audit). A run loads the CX
 * turns stored since the previous completed run, hands them to the agents'
 * checks + rules judge (`runAudit`), stores the run and its findings, and posts
 * a `conversation.audited` feed card. Started by the cron worker
 * (`conversationAudit.schedule`) or on demand by the copilot.
 */
import {
  runConversationAuditSchema,
  listConversationAuditFindingsSchema,
  withErrorHandlingAndValidation,
  type ConversationAuditAgentSummary,
  type ConversationAuditTopFinding,
  type ConversationAuditTrigger
} from "@mikro/common";
import {
  runAudit,
  auditHeadline,
  auditStatusFallback,
  type AuditStatusInput,
  type WriteAuditStatus,
  type AgentPolicy,
  type AuditConversation,
  type AuditFinding,
  type AuditTurn,
  type JudgeConversation
} from "@mikro/agents";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { recordEvent } from "../events/recordEvent.js";
import { logger } from "../../logger.js";

type AuditClient = Pick<
  PrismaClient,
  | "conversationTurn"
  | "conversationHandoff"
  | "conversationAuditRun"
  | "conversationAuditFinding"
  | "loanApplication"
  | "customer"
  | "businessEvent"
  | "$transaction"
>;

/** The first run (no completed run yet) looks back this far. */
export const AUDIT_FIRST_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Turns before the window the judge sees per conversation, as context. */
export const AUDIT_CONTEXT_TURNS = 20;
/** A RUNNING run older than this is treated as crashed and marked FAILED. */
export const AUDIT_STALE_RUN_MS = 30 * 60 * 1000;
/** Upper bound on turns one run loads; a backlog beyond it waits for the next run. */
export const AUDIT_MAX_TURNS = 20_000;

/** Another run is in progress; the caller relays the message. */
export class AuditInProgressError extends Error {
  constructor() {
    super("Ya hay una auditoría de conversaciones en curso. Intenta de nuevo en unos minutos.");
    this.name = "AuditInProgressError";
  }
}

export interface RunConversationAuditDeps {
  judge: JudgeConversation;
  /** Policies of an agent by the name stored on its turns. */
  getAgent: (agentName: string) => { name: string; policies: AgentPolicy[] } | undefined;
  getMaxConversations: () => number;
  /** Writes the card's status paragraph when there are problems (LLM). Falls back to the template. */
  writeStatus?: WriteAuditStatus;
  now?: () => Date;
}

export interface ConversationAuditRunResult {
  runId: string;
  /** The verdict in words, as on the feed card. */
  statusText: string;
  flaggedConversations: number;
  conversations: number;
  turns: number;
  handoffs: number;
  failedSends: number;
  criticalCount: number;
  warningCount: number;
  judged: number;
  judgeSkipped: number;
  judgeErrors: number;
}

type TurnRow = Awaited<ReturnType<PrismaClient["conversationTurn"]["findMany"]>>[number];

function toAuditTurn(row: TurnRow, context = false): AuditTurn {
  let toolNames: string[] = [];
  if (row.toolCalls) {
    try {
      const parsed = JSON.parse(row.toolCalls) as Array<{ name?: unknown }>;
      toolNames = parsed.map((c) => (typeof c.name === "string" ? c.name : "")).filter(Boolean);
    } catch {
      toolNames = [];
    }
  }
  return {
    id: row.id,
    role: row.role as AuditTurn["role"],
    content: row.content,
    profile: row.profile,
    agentName: row.agentName,
    agentVersion: row.agentVersion,
    toolNames,
    applicationId: row.applicationId,
    customerId: row.customerId,
    failed: row.failed,
    createdAt: row.createdAt,
    ...(context ? { context: true } : {})
  };
}

/** "Yokasta Medina", else the customer's name, else the phone. */
async function personLabels(
  db: AuditClient,
  refs: Array<{ phone: string; applicationId: string | null; customerId: string | null }>
): Promise<Map<string, string>> {
  const appIds = [...new Set(refs.map((r) => r.applicationId).filter((x): x is string => !!x))];
  const customerIds = [...new Set(refs.map((r) => r.customerId).filter((x): x is string => !!x))];
  const [apps, customers] = await Promise.all([
    appIds.length
      ? db.loanApplication.findMany({
          where: { id: { in: appIds } },
          select: { id: true, firstName: true, lastName: true }
        })
      : Promise.resolve([]),
    customerIds.length
      ? db.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true }
        })
      : Promise.resolve([])
  ]);
  const byApp = new Map(
    apps.map((a) => [a.id, `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim()] as const)
  );
  const byCustomer = new Map(customers.map((c) => [c.id, c.name] as const));
  const labels = new Map<string, string>();
  for (const r of refs) {
    const label =
      (r.customerId && byCustomer.get(r.customerId)) ||
      (r.applicationId && byApp.get(r.applicationId)) ||
      r.phone;
    labels.set(`${r.phone}|${r.applicationId ?? ""}|${r.customerId ?? ""}`, label);
  }
  return labels;
}

const labelKey = (r: { phone: string; applicationId: string | null; customerId: string | null }) =>
  `${r.phone}|${r.applicationId ?? ""}|${r.customerId ?? ""}`;

/** The finding the card previews: the first critical, else the first warning. */
function pickTopFinding(findings: AuditFinding[]): AuditFinding | undefined {
  return findings.find((f) => f.severity === "CRITICAL") ?? findings[0];
}

/**
 * The card's status paragraph: the LLM's words when there are problems, the
 * fixed template for clean runs or when the LLM fails.
 */
async function statusFor(input: AuditStatusInput, writeStatus?: WriteAuditStatus): Promise<string> {
  if (input.findings.length === 0 || !writeStatus) return auditStatusFallback(input);
  try {
    return await writeStatus(input);
  } catch (error) {
    logger.warn("conversation audit: status writer failed, using the template", {
      error: (error as Error).message
    });
    return auditStatusFallback(input);
  }
}

/**
 * Take the single-run lock: fail when a fresh run is in progress, retire a
 * stale one, then create this run as RUNNING — atomically.
 */
async function startRun(
  db: AuditClient,
  trigger: ConversationAuditTrigger,
  actorName: string,
  now: Date
): Promise<string> {
  return db.$transaction(async (tx) => {
    const running = await tx.conversationAuditRun.findMany({ where: { status: "RUNNING" } });
    const fresh = running.filter((r) => now.getTime() - r.startedAt.getTime() < AUDIT_STALE_RUN_MS);
    if (fresh.length > 0) throw new AuditInProgressError();
    if (running.length > 0) {
      await tx.conversationAuditRun.updateMany({
        where: { id: { in: running.map((r) => r.id) } },
        data: { status: "FAILED", finishedAt: now, error: "Interrumpida (no terminó)" }
      });
    }
    const run = await tx.conversationAuditRun.create({
      data: { trigger, actorName, status: "RUNNING", startedAt: now }
    });
    return run.id;
  });
}

/**
 * Run one audit. Throws `AuditInProgressError` while another run is fresh;
 * any other failure marks the run FAILED and rethrows.
 */
export function createRunConversationAudit(db: AuditClient, deps: RunConversationAuditDeps) {
  const clock = deps.now ?? (() => new Date());

  return withErrorHandlingAndValidation(
    async ({ trigger, actorName }): Promise<ConversationAuditRunResult> => {
      const now = clock();
      const runId = await startRun(db, trigger, actorName, now);

      try {
        const previous = await db.conversationAuditRun.findFirst({
          where: { status: "DONE", id: { not: runId } },
          orderBy: { startedAt: "desc" }
        });

        const turnsWhere =
          previous?.lastTurnId != null
            ? { id: { gt: previous.lastTurnId } }
            : { createdAt: { gte: new Date(now.getTime() - AUDIT_FIRST_WINDOW_MS) } };
        const rows = await db.conversationTurn.findMany({
          where: turnsWhere,
          orderBy: { id: "asc" },
          take: AUDIT_MAX_TURNS
        });

        const byPhone = new Map<string, TurnRow[]>();
        for (const row of rows) {
          const list = byPhone.get(row.phone) ?? [];
          list.push(row);
          byPhone.set(row.phone, list);
        }
        const phones = [...byPhone.keys()];

        const [contextRows, handoffRows] = await Promise.all([
          Promise.all(
            phones.map((phone) =>
              db.conversationTurn.findMany({
                where: { phone, id: { lt: byPhone.get(phone)![0]!.id } },
                orderBy: { id: "desc" },
                take: AUDIT_CONTEXT_TURNS
              })
            )
          ),
          phones.length
            ? db.conversationHandoff.findMany({
                where: { phone: { in: phones } },
                select: { phone: true, openedAt: true }
              })
            : Promise.resolve([])
        ]);

        const conversations: AuditConversation[] = phones.map((phone, i) => ({
          phone,
          turns: [
            ...contextRows[i]!.reverse().map((r) => toAuditTurn(r, true)),
            ...byPhone.get(phone)!.map((r) => toAuditTurn(r))
          ],
          handoffsOpenedAt: handoffRows.filter((h) => h.phone === phone).map((h) => h.openedAt)
        }));

        const previousVersions: Record<string, string | null> = {};
        if (previous) {
          for (const a of JSON.parse(previous.byAgent) as ConversationAuditAgentSummary[]) {
            previousVersions[a.agentName] = a.agentVersion;
          }
        }

        const result = await runAudit({
          conversations,
          getAgent: deps.getAgent,
          maxConversations: deps.getMaxConversations(),
          judge: deps.judge,
          previousVersions
        });

        const windowStart = rows[0]?.createdAt ?? null;
        const handoffs = await db.conversationHandoff.count({
          where: {
            openedAt: {
              gte: windowStart ?? new Date(now.getTime() - AUDIT_FIRST_WINDOW_MS),
              lte: now
            }
          }
        });

        // Critical first, then conversation order, so the card previews the worst.
        const findings = [...result.findings].sort(
          (a, b) =>
            (a.severity === "CRITICAL" ? 0 : 1) - (b.severity === "CRITICAL" ? 0 : 1) ||
            (a.turnId ?? 0) - (b.turnId ?? 0)
        );
        if (findings.length > 0) {
          await db.conversationAuditFinding.createMany({
            data: findings.map((f) => ({ runId, ...f }))
          });
        }

        const lastTurnId = rows.at(-1)?.id ?? previous?.lastTurnId ?? null;
        const counts = {
          conversations: result.conversations,
          turns: result.turns,
          handoffs,
          failedSends: result.failedSends,
          criticalCount: result.criticalCount,
          warningCount: result.warningCount,
          judged: result.judged,
          judgeSkipped: result.judgeSkipped,
          judgeErrors: result.judgeErrors
        };
        await db.conversationAuditRun.update({
          where: { id: runId },
          data: {
            ...counts,
            status: "DONE",
            finishedAt: clock(),
            windowStart,
            firstTurnId: rows[0]?.id ?? null,
            lastTurnId,
            byAgent: JSON.stringify(result.byAgent)
          }
        });

        const top = pickTopFinding(findings);
        let topFinding: ConversationAuditTopFinding | null = null;
        if (top) {
          const labels = await personLabels(db, [top]);
          const turn = top.turnId != null ? rows.find((r) => r.id === top.turnId) : undefined;
          topFinding = {
            severity: top.severity,
            rule: top.rule,
            agentName: top.agentName,
            personLabel: labels.get(labelKey(top)) ?? top.phone,
            quote: top.evidence,
            applicationId: top.applicationId,
            turnAt: turn?.createdAt.toISOString() ?? null
          };
        }

        const flaggedConversations = new Set(findings.map((f) => f.phone)).size;
        const statusText = await statusFor(
          {
            conversations: counts.conversations,
            flaggedConversations,
            handoffs: counts.handoffs,
            findings: findings.map((f) => ({
              severity: f.severity,
              agentName: f.agentName,
              rule: f.rule,
              reason: f.reason
            }))
          },
          deps.writeStatus
        );

        await recordEvent(db as unknown as PrismaClient, {
          type: "conversation.audited",
          actorName: trigger === "SCHEDULED" ? "Sistema" : actorName,
          summary: `Auditoría de conversaciones ${auditHeadline(counts.conversations, flaggedConversations)}`,
          payload: {
            runId,
            trigger,
            ...counts,
            flaggedConversations,
            statusText,
            windowStart: windowStart?.toISOString() ?? null,
            byAgent: result.byAgent,
            topFinding
          }
        });

        logger.info("conversation audit done", { runId, trigger, ...counts });
        return { runId, statusText, flaggedConversations, ...counts };
      } catch (error) {
        await db.conversationAuditRun
          .update({
            where: { id: runId },
            data: { status: "FAILED", finishedAt: clock(), error: (error as Error).message }
          })
          .catch(() => undefined);
        throw error;
      }
    },
    runConversationAuditSchema
  );
}

/** A finding as the detail panel shows it. */
export interface ConversationAuditFindingView {
  id: string;
  phone: string;
  personLabel: string;
  applicationId: string | null;
  customerId: string | null;
  profile: string | null;
  agentName: string | null;
  agentVersion: string | null;
  checkId: string;
  source: "CODE" | "JUDGE";
  severity: "CRITICAL" | "WARNING";
  rule: string;
  evidence: string | null;
  reason: string;
  /** The cited turn, when it still exists. */
  turn: {
    id: number;
    role: string;
    agentName: string | null;
    failed: boolean;
    createdAt: Date;
  } | null;
}

export interface ConversationAuditDetail {
  run: {
    id: string;
    trigger: string;
    actorName: string;
    status: string;
    startedAt: Date;
    windowStart: Date | null;
    conversations: number;
    handoffs: number;
    failedSends: number;
    criticalCount: number;
    warningCount: number;
    judged: number;
    judgeSkipped: number;
    judgeErrors: number;
  };
  findings: ConversationAuditFindingView[];
}

/** One run with its findings (critical first), for the detail panel. */
export function createListConversationAuditFindings(db: AuditClient) {
  return withErrorHandlingAndValidation(
    async ({ runId }): Promise<ConversationAuditDetail | null> => {
      const run = await db.conversationAuditRun.findUnique({ where: { id: runId } });
      if (!run) return null;
      const rows = await db.conversationAuditFinding.findMany({
        where: { runId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      });
      const turnIds = rows.map((r) => r.turnId).filter((x): x is number => x != null);
      const [labels, turns] = await Promise.all([
        personLabels(db, rows),
        turnIds.length
          ? db.conversationTurn.findMany({
              where: { id: { in: turnIds } },
              select: { id: true, role: true, agentName: true, failed: true, createdAt: true }
            })
          : Promise.resolve([])
      ]);
      const turnById = new Map(turns.map((t) => [t.id, t] as const));
      const findings: ConversationAuditFindingView[] = rows
        .map((r) => ({
          id: r.id,
          phone: r.phone,
          personLabel: labels.get(labelKey(r)) ?? r.phone,
          applicationId: r.applicationId,
          customerId: r.customerId,
          profile: r.profile,
          agentName: r.agentName,
          agentVersion: r.agentVersion,
          checkId: r.checkId,
          source: r.source as "CODE" | "JUDGE",
          severity: r.severity as "CRITICAL" | "WARNING",
          rule: r.rule,
          evidence: r.evidence,
          reason: r.reason,
          turn: r.turnId != null ? (turnById.get(r.turnId) ?? null) : null
        }))
        .sort((a, b) => (a.severity === "CRITICAL" ? 0 : 1) - (b.severity === "CRITICAL" ? 0 : 1));
      return {
        run: {
          id: run.id,
          trigger: run.trigger,
          actorName: run.actorName,
          status: run.status,
          startedAt: run.startedAt,
          windowStart: run.windowStart,
          conversations: run.conversations,
          handoffs: run.handoffs,
          failedSends: run.failedSends,
          criticalCount: run.criticalCount,
          warningCount: run.warningCount,
          judged: run.judged,
          judgeSkipped: run.judgeSkipped,
          judgeErrors: run.judgeErrors
        },
        findings
      };
    },
    listConversationAuditFindingsSchema
  );
}
