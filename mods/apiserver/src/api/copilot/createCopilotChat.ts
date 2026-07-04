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
import type { CopilotChatReply } from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { logger } from "../../logger.js";
import { COPILOT_SYSTEM_PROMPT } from "./systemPrompt.js";
import { summarizeAction } from "./summarizeAction.js";
import { createWatchRule, disableWatchRule, type WatchRuleView } from "./watchRules.js";
import { getCopilotToolDefinitions, isReadTool, isWriteTool, isDirectTool } from "./toolPolicy.js";

const MAX_TOOL_ITERATIONS = 10;
const HISTORY_WINDOW = 20;

export interface CopilotChatDeps {
  db: PrismaClient;
  toolExecutor: ToolExecutor;
  createModel: () => BaseChatModel;
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
  const { db, toolExecutor, createModel } = deps;

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
          customerName: e.customerName
        }))
      }
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

    const lcMessages: BaseMessage[] = [new SystemMessage(COPILOT_SYSTEM_PROMPT)];
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
        } else if (tc.name === "listWatchRules") {
          result = await handleListWatchRules(tc.args);
        } else if (tc.name === "createWatchRule") {
          const outcome = await handleCreateWatchRule(tc.args, userId);
          result = outcome.result;
          if (outcome.rule) createdRule = outcome.rule;
        } else if (tc.name === "disableWatchRule") {
          result = await handleDisableWatchRule(tc.args);
        } else {
          // Existing business read tool → shared executor.
          result = await toolExecutor(tc.name, tc.args, context);
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

    const reply =
      getText(response.content).trim() ||
      (createdRule ? `Listo, creé la regla "${createdRule.name}".` : "");

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
        : {})
    };
  };
}
