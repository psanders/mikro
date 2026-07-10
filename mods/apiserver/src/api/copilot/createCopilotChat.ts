/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The copilot chat loop (design Decisions 2–4). Modeled on the WhatsApp invoke
 * loop (`createInvokeLLM`) but with the copilot tool policy baked in:
 *
 *  - History: the last 20 copilot-channel messages for the founder rebuild the
 *    context window (the same rows the dock reloads).
 *  - Tools: only READ + WRITE + DIRECT tools are bound; anything else is
 *    unreachable.
 *  - READ tools execute inline (existing tools via the shared executor; the
 *    copilot's own read tools inline). DIRECT tools (watch rules) execute inline.
 *  - The FIRST time the model calls a WRITE tool the loop short-circuits: it
 *    persists a CopilotPendingAction and returns it — nothing mutates until the
 *    founder confirms.
 *
 * The HUMAN message is persisted on entry, the AI message on exit (with the tool
 * provenance stored in the `tools` JSON column).
 */
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  ToolMessage,
  type BaseMessage
} from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ToolExecutor, ToolResult } from "@mikro/agents";
import type { CopilotChatReply, DbClient } from "@mikro/common";
import { amountToNumber } from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { logger } from "../../logger.js";
import { buildCopilotSystemPrompt } from "./systemPrompt.js";
import { summarizeAction } from "./summarizeAction.js";
import { createWatchRule, disableWatchRule, type WatchRuleView } from "./watchRules.js";
import { getCopilotToolDefinitions, isReadTool, isWriteTool, isDirectTool } from "./toolPolicy.js";
import { createTask, listTasks, cancelTask, getAutomation } from "../../tasks/index.js";
import { createGetLoanHealth } from "../loans/createGetLoanHealth.js";
import { createRunPortfolioHealthCheck } from "../reports/createRunPortfolioHealthCheck.js";
import { computeWatchMetric } from "./metrics.js";

const MAX_TOOL_ITERATIONS = 10;
const HISTORY_WINDOW = 20;

export interface CopilotChatDeps {
  db: PrismaClient;
  toolExecutor: ToolExecutor;
  createModel: () => BaseChatModel;
  /** Files a GitHub issue for the `githubFeedback` tool. See CopilotDeps for the full contract. */
  fileFeedback?: (input: { title: string; body: string }) => Promise<{ issueUrl: string }>;
}

/** The most recently failed/limited tool call in the turn — attached to a githubFeedback filing automatically. */
interface FailedToolCall {
  toolName: string;
  args: Record<string, unknown>;
  reason?: string;
}

export interface CopilotChatParams {
  userId: string;
  /** The founder's display name (for context); optional. */
  actorName?: string;
  message: string;
}

interface PendingActionRow {
  id: string;
  toolName: string;
  argsJson: string;
  summary: string;
  status: string;
  createdAt: Date;
}

/** Extract plain text from a LangChain message content (string or blocks). */
function getText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as Array<{ type: string; text?: string }>)
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("");
  }
  return "";
}

/** LangChain tool-call shape returned on an AI message. */
interface LcToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

/**
 * Creates the copilot chat function.
 */
export function createCopilotChat(deps: CopilotChatDeps) {
  const { db, toolExecutor, createModel, fileFeedback } = deps;

  const toPendingView = (row: PendingActionRow) => ({
    id: row.id,
    toolName: row.toolName,
    args: JSON.parse(row.argsJson) as Record<string, unknown>,
    summary: row.summary,
    status: row.status as "PENDING" | "CONFIRMED" | "REJECTED" | "EXPIRED",
    createdAt: row.createdAt
  });

  /** Query the business-event log (copilot read tool). */
  async function handleQueryFeedEvents(args: Record<string, unknown>): Promise<ToolResult> {
    const rawLimit = args.limit !== undefined ? Number(args.limit) : NaN;
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 20;
    const types =
      typeof args.types === "string" && args.types.trim()
        ? args.types
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
    const from = args.from ? new Date(String(args.from)) : undefined;
    const to = args.to ? new Date(String(args.to)) : undefined;

    const occurredAt: { gte?: Date; lte?: Date } = {};
    if (from && !Number.isNaN(from.getTime())) occurredAt.gte = from;
    if (to && !Number.isNaN(to.getTime())) occurredAt.lte = to;

    const events = await db.businessEvent.findMany({
      where: {
        ...(types && types.length ? { type: { in: types } } : {}),
        ...(occurredAt.gte || occurredAt.lte ? { occurredAt } : {})
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: limit
    });

    return {
      success: true,
      message: `${events.length} evento(s) encontrado(s).`,
      data: {
        events: events.map((e) => ({
          type: e.type,
          occurredAt: e.occurredAt,
          summary: e.summary,
          actorName: e.actorName,
          customerName: e.customerName,
          // mikro/#115: payment-type events carry an amount the model needs to
          // sum ("¿cuánto se cobró hoy?") — previously stripped here even
          // though BusinessEvent.amount is populated for payment.collected.
          amount: e.amount !== null ? amountToNumber(e.amount) : null
        }))
      }
    };
  }

  /**
   * Today's total cash collected (copilot read tool, mikro/#115). Wraps the
   * same `cobranza_diaria` computation the watch-rule evaluator uses
   * (`computeWatchMetric`), so this number always matches what a watch rule on
   * that metric would see. `date` lets the founder ask about a prior day
   * during reconciliation ("¿y ayer?"); defaults to now.
   */
  async function handleGetDailyCashCollected(args: Record<string, unknown>): Promise<ToolResult> {
    let asOf = new Date();
    if (typeof args.date === "string" && args.date.trim()) {
      const parsed = new Date(args.date);
      if (Number.isNaN(parsed.getTime())) {
        return {
          success: false,
          message: `Fecha inválida: "${args.date}". Use formato YYYY-MM-DD.`
        };
      }
      asOf = parsed;
    }
    const total = await computeWatchMetric(db, { metric: "cobranza_diaria" }, asOf);
    const dateLabel = asOf.toISOString().slice(0, 10);
    return {
      success: true,
      message: `Total cobrado el ${dateLabel}: RD$${total}.`,
      data: { date: dateLabel, totalCollected: total }
    };
  }

  /** List watch rules (copilot read tool). */
  async function handleListWatchRules(args: Record<string, unknown>): Promise<ToolResult> {
    const includeDisabled = String(args.includeDisabled) === "true";
    const rows = await db.watchRule.findMany({
      where: includeDisabled ? {} : { enabled: true },
      orderBy: { createdAt: "desc" }
    });
    return {
      success: true,
      message: `${rows.length} regla(s).`,
      data: {
        rules: rows.map((r) => ({
          id: r.id,
          name: r.name,
          metric: r.metric,
          comparator: r.comparator,
          threshold: r.threshold,
          collectorId: r.collectorId,
          enabled: r.enabled
        }))
      }
    };
  }

  /** Create a watch rule (copilot DIRECT tool). Coerces string args to numbers. */
  async function handleCreateWatchRule(
    args: Record<string, unknown>,
    userId: string
  ): Promise<{ result: ToolResult; rule?: WatchRuleView }> {
    try {
      const rule = await createWatchRule(
        db,
        {
          name: args.name,
          metric: args.metric,
          comparator: args.comparator,
          threshold: args.threshold !== undefined ? Number(args.threshold) : undefined,
          collectorId: args.collectorId ? String(args.collectorId) : undefined
        },
        userId
      );
      return {
        result: { success: true, message: `Regla "${rule.name}" creada.`, data: { rule } },
        rule
      };
    } catch (error) {
      return { result: { success: false, message: (error as Error).message } };
    }
  }

  /** Disable a watch rule (copilot DIRECT tool). */
  async function handleDisableWatchRule(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const rule = await disableWatchRule(db, String(args.id));
      return { success: true, message: `Regla "${rule.name}" desactivada.`, data: { rule } };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /**
   * Resolve name-typed static params to UUIDs so the model can say "Caja
   * principal" instead of an id it cannot know. Only slots whose kind is
   * collector/account/category are resolved; UUIDs pass through untouched.
   * Exact match first, contains as fallback (unique names enforced by schema
   * for accounts/categories).
   */
  async function resolveStaticParamNames(
    automationId: string,
    staticParams: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const automation = getAutomation(automationId);
    if (!automation) return staticParams;

    const resolved: Record<string, unknown> = { ...staticParams };
    for (const [name, spec] of Object.entries(automation.params)) {
      const value = resolved[name];
      if (typeof value !== "string" || value === "" || UUID_RE.test(value)) continue;

      if (spec.kind === "collector") {
        const user =
          (await db.user.findFirst({ where: { name: value }, select: { id: true } })) ??
          (await db.user.findFirst({ where: { name: { contains: value } }, select: { id: true } }));
        if (user) resolved[name] = user.id;
      } else if (spec.kind === "account") {
        const account =
          (await db.accountingAccount.findFirst({
            where: { name: value },
            select: { id: true }
          })) ??
          (await db.accountingAccount.findFirst({
            where: { name: { contains: value } },
            select: { id: true }
          }));
        if (account) resolved[name] = account.id;
      } else if (spec.kind === "category") {
        const category =
          (await db.accountingCategory.findFirst({
            where: { name: value },
            select: { id: true }
          })) ??
          (await db.accountingCategory.findFirst({
            where: { name: { contains: value } },
            select: { id: true }
          }));
        if (category) resolved[name] = category.id;
      }
    }
    return resolved;
  }

  /** Create a scheduled task (copilot DIRECT tool). Coerces string args. */
  async function handleCreateTask(
    args: Record<string, unknown>,
    userId: string
  ): Promise<ToolResult> {
    try {
      const automationId = String(args.automationId ?? "");
      const rawParams =
        typeof args.staticParams === "object" && args.staticParams !== null
          ? (args.staticParams as Record<string, unknown>)
          : {};
      const staticParams = await resolveStaticParamNames(automationId, rawParams);

      const task = await createTask(
        db,
        {
          name: args.name,
          automationId,
          frequency: args.frequency,
          weekday: args.weekday !== undefined ? Number(args.weekday) : undefined,
          dayOfMonth: args.dayOfMonth !== undefined ? Number(args.dayOfMonth) : undefined,
          onDate: args.onDate ? String(args.onDate) : undefined,
          timeOfDay: args.timeOfDay,
          staticParams
        },
        userId
      );
      return {
        success: true,
        message: `Tarea "${task.name}" creada. Próximo disparo: ${task.nextFireAt?.toISOString() ?? "—"}.`,
        data: { task }
      };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  /** List scheduled tasks (copilot read tool). */
  async function handleListTasks(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const tasks = await listTasks(db, {
        includeDisabled: String(args.includeDisabled) === "true"
      });
      return { success: true, message: `${tasks.length} tarea(s).`, data: { tasks } };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  /** Cancel a scheduled task (copilot DIRECT tool). */
  async function handleCancelTask(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const result = await cancelTask(db, { id: String(args.id) });
      return { success: true, message: "Tarea cancelada.", data: result };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  /** Single-loan health check (copilot read tool). Numbers are deterministic; the model only summarizes. */
  async function handleGetLoanHealth(args: Record<string, unknown>): Promise<ToolResult> {
    const loanId = Number(args.loanId);
    if (!Number.isFinite(loanId)) {
      return { success: false, message: "loanId inválido." };
    }
    const explain = String(args.explain) === "true";
    try {
      const fn = createGetLoanHealth(db as unknown as DbClient, {
        createModel: explain ? createModel : undefined
      });
      const { snapshot, report, narration } = await fn({ loanId, explain });
      return {
        success: true,
        message: report.pass
          ? `Préstamo #${loanId}: ${report.passCount}/${report.results.length} verificaciones OK.`
          : `Préstamo #${loanId}: ${report.failCount} verificación(es) fallando.`,
        data: {
          loanId,
          customer: snapshot.customer.nickname ?? snapshot.customer.name,
          derived: snapshot.derived,
          pass: report.pass,
          failing: report.results
            .filter((r) => !r.pass)
            .map((r) => ({ id: r.id, expected: r.expected, actual: r.actual })),
          narration
        }
      };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  /** Portfolio-wide health check (copilot read tool). Deterministic aggregate. */
  async function handleRunPortfolioHealthCheck(args: Record<string, unknown>): Promise<ToolResult> {
    const includeAllStatuses = String(args.includeAllStatuses) === "true";
    try {
      const fn = createRunPortfolioHealthCheck(db as unknown as DbClient);
      const report = await fn({ includeAllStatuses });
      return {
        success: true,
        message: `${report.loansPassing}/${report.loansChecked} préstamos sanos; ${report.loansFailing} con problemas.`,
        data: {
          loansChecked: report.loansChecked,
          loansPassing: report.loansPassing,
          loansFailing: report.loansFailing,
          failuresByCheck: report.failuresByCheck,
          offenders: report.offenders.slice(0, 15)
        }
      };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  /**
   * File a GitHub issue for a bug, missing capability, or UI idea (copilot
   * DIRECT tool, design Decision 4). `reasoning` is required — a call missing
   * it is rejected without filing anything. `lastFailedCall`, if present, is
   * attached as tool-context so the issue is actionable without re-deriving
   * what triggered it.
   */
  async function handleGithubFeedback(
    args: Record<string, unknown>,
    lastFailedCall: FailedToolCall | undefined
  ): Promise<ToolResult> {
    const category = typeof args.category === "string" ? args.category : "other";
    const title = typeof args.title === "string" ? args.title.trim() : "";
    const summary = typeof args.summary === "string" ? args.summary.trim() : "";
    const reasoning = typeof args.reasoning === "string" ? args.reasoning.trim() : "";

    if (!title || !summary || !reasoning) {
      return {
        success: false,
        message: "Falta título, resumen o razonamiento — no se registró el feedback."
      };
    }

    if (!fileFeedback) {
      return { success: false, message: "El feedback no está configurado." };
    }

    const bodyLines = [
      `**Categoría:** ${category}`,
      "",
      "## Resumen",
      summary,
      "",
      "## Razonamiento",
      reasoning
    ];
    if (lastFailedCall) {
      bodyLines.push(
        "",
        "## Contexto de la herramienta",
        `Herramienta: \`${lastFailedCall.toolName}\``,
        `Argumentos: \`${JSON.stringify(lastFailedCall.args)}\``,
        ...(lastFailedCall.reason ? [`Motivo: \`${lastFailedCall.reason}\``] : [])
      );
    }
    bodyLines.push("", "---", "Reportado por el copiloto del fundador durante una conversación.");

    try {
      const { issueUrl } = await fileFeedback({ title, body: bodyLines.join("\n") });
      return { success: true, message: `Feedback registrado: ${issueUrl}`, data: { issueUrl } };
    } catch (error) {
      return {
        success: false,
        message: `No se pudo registrar el feedback: ${(error as Error).message}`
      };
    }
  }

  return async function copilotChat(params: CopilotChatParams): Promise<CopilotChatReply> {
    const { userId, actorName, message } = params;
    const startedAt = Date.now();

    // Persist the HUMAN message first so it's part of the reloaded window.
    await db.message.create({
      data: { role: "HUMAN", content: message, userId, channel: "copilot" }
    });

    // Rebuild the context window from the last N copilot messages (chronological).
    const historyRows = await db.message.findMany({
      where: { userId, channel: "copilot", deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: HISTORY_WINDOW
    });
    const chronological = [...historyRows].reverse();

    const today = new Date().toLocaleDateString("es-DO", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    const systemPrompt = buildCopilotSystemPrompt({ actorName, today });
    const lcMessages: BaseMessage[] = [new SystemMessage(systemPrompt)];
    for (const row of chronological) {
      if (row.role === "AI") {
        lcMessages.push(new AIMessage(row.content));
      } else {
        lcMessages.push(new HumanMessage(row.content));
      }
    }

    // Bind ONLY the policy tools. Anything outside the three lists is uncallable.
    const toolDefs = getCopilotToolDefinitions().map((t) => ({
      type: "function" as const,
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters
      }
    }));
    const model = createModel();
    const bound = model.bindTools ? model.bindTools(toolDefs, { tool_choice: "auto" }) : model;

    const context: Record<string, unknown> = { userId, role: "ADMIN", name: actorName };
    const toolsUsed: string[] = [];
    let createdRule: WatchRuleView | undefined;
    let contractForm: { customerHint?: string } | undefined;
    // Tracks the most recent failed/limited tool call so a githubFeedback call
    // right after it can attach that context automatically (design Decision 4).
    let lastFailedCall: FailedToolCall | undefined;
    // Whether githubFeedback fired this turn, and whether it succeeded — drives
    // the mandatory disclosure appended to the reply below (no silent filing).
    let feedbackOutcome: { ok: boolean } | undefined;

    const persistAI = async (content: string): Promise<void> => {
      await db.message.create({
        data: {
          role: "AI",
          content,
          userId,
          channel: "copilot",
          tools: toolsUsed.length ? JSON.stringify(toolsUsed) : null
        }
      });
    };

    const provenance = () =>
      toolsUsed.length ? { tools: [...toolsUsed], elapsedMs: Date.now() - startedAt } : undefined;

    let response = await bound.invoke(lcMessages);
    let iterations = 0;

    while (
      "tool_calls" in response &&
      Array.isArray(response.tool_calls) &&
      response.tool_calls.length > 0
    ) {
      iterations += 1;
      if (iterations > MAX_TOOL_ITERATIONS) {
        logger.error("copilot tool loop exceeded max iterations", { userId });
        break;
      }

      const toolCalls = response.tool_calls as LcToolCall[];

      // WRITE short-circuit: a write tool NEVER executes inline. Persist a
      // pending action for the first write call and return it for confirmation.
      const writeCall = toolCalls.find((tc) => isWriteTool(tc.name));
      if (writeCall) {
        const summary = summarizeAction(writeCall.name, writeCall.args);
        const pending = await db.copilotPendingAction.create({
          data: {
            userId,
            toolName: writeCall.name,
            argsJson: JSON.stringify(writeCall.args),
            summary,
            status: "PENDING"
          }
        });
        const replyText = getText(response.content).trim() || summary;
        await persistAI(replyText);
        return {
          reply: replyText,
          ...(provenance() ? { provenance: provenance() } : {}),
          pendingAction: toPendingView(pending)
        };
      }

      lcMessages.push(response);

      const toolMessages: ToolMessage[] = [];
      for (const tc of toolCalls) {
        if (!isReadTool(tc.name) && !isDirectTool(tc.name)) {
          // Defensive: model returned an unbound tool. Never execute it.
          toolMessages.push(
            new ToolMessage({
              content: JSON.stringify({
                success: false,
                message: `Herramienta no permitida: ${tc.name}`
              }),
              tool_call_id: tc.id ?? "",
              name: tc.name
            })
          );
          continue;
        }

        toolsUsed.push(tc.name);
        let result: ToolResult;
        if (tc.name === "queryFeedEvents") {
          result = await handleQueryFeedEvents(tc.args);
        } else if (tc.name === "getDailyCashCollected") {
          result = await handleGetDailyCashCollected(tc.args);
        } else if (tc.name === "listWatchRules") {
          result = await handleListWatchRules(tc.args);
        } else if (tc.name === "createWatchRule") {
          const outcome = await handleCreateWatchRule(tc.args, userId);
          result = outcome.result;
          if (outcome.rule) createdRule = outcome.rule;
        } else if (tc.name === "disableWatchRule") {
          result = await handleDisableWatchRule(tc.args);
        } else if (tc.name === "createTask") {
          result = await handleCreateTask(tc.args, userId);
        } else if (tc.name === "listTasks") {
          result = await handleListTasks(tc.args);
        } else if (tc.name === "cancelTask") {
          result = await handleCancelTask(tc.args);
        } else if (tc.name === "getLoanHealth") {
          result = await handleGetLoanHealth(tc.args);
        } else if (tc.name === "runPortfolioHealthCheck") {
          result = await handleRunPortfolioHealthCheck(tc.args);
        } else if (tc.name === "githubFeedback") {
          result = await handleGithubFeedback(tc.args, lastFailedCall);
          feedbackOutcome = { ok: result.success };
        } else if (tc.name === "openContractForm") {
          // Generates nothing: just opens the form card in the dock. The card
          // collects the terms and calls generateCustomerContract directly.
          const hint =
            typeof tc.args?.customerHint === "string" ? tc.args.customerHint.trim() : undefined;
          contractForm = hint ? { customerHint: hint } : {};
          result = {
            success: true,
            message: "Formulario de contrato abierto. El fundador completará los datos."
          };
        } else {
          // Existing business read tool → shared executor.
          result = await toolExecutor(tc.name, tc.args, context);
        }

        // Track failures for a subsequent githubFeedback call to attach — but
        // not githubFeedback's own outcome, so a failed filing doesn't become
        // "context" for the next filing attempt.
        if (!result.success && tc.name !== "githubFeedback") {
          lastFailedCall = { toolName: tc.name, args: tc.args, reason: result.reason };
        }

        toolMessages.push(
          new ToolMessage({
            content: JSON.stringify(result),
            tool_call_id: tc.id ?? "",
            name: tc.name
          })
        );
      }

      lcMessages.push(...toolMessages);
      response = await bound.invoke(lcMessages);
    }

    const modelReply =
      getText(response.content).trim() ||
      (createdRule
        ? `Listo, creé la regla "${createdRule.name}".`
        : contractForm
          ? "Listo. Completá los datos del préstamo y lo genero."
          : "");

    // Mandatory disclosure (design Decision 4 / spec "no silent issue filing"):
    // appended deterministically, not left to the model's own phrasing, so a
    // GitHub issue never appears without the founder being told in this reply.
    const disclosure = feedbackOutcome
      ? feedbackOutcome.ok
        ? "Registré esto como una mejora pendiente."
        : "Intenté registrar esto como feedback, pero no se pudo completar."
      : undefined;
    const reply = disclosure ? [modelReply, disclosure].filter(Boolean).join(" ") : modelReply;

    await persistAI(reply);

    return {
      reply,
      ...(provenance() ? { provenance: provenance() } : {}),
      ...(createdRule
        ? {
            createdRule: {
              id: createdRule.id,
              name: createdRule.name,
              metric: createdRule.metric,
              comparator: createdRule.comparator,
              threshold: createdRule.threshold,
              collectorId: createdRule.collectorId
            }
          }
        : {}),
      ...(contractForm ? { contractForm } : {})
    };
  };
}
