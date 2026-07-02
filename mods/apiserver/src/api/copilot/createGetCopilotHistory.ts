/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Read the founder's copilot conversation (design Decision 4). Channel-filtered
 * to `copilot` so WhatsApp messages never leak in, and returns the pending
 * actions so the dock can re-render confirm cards after a reload.
 */
import type { PrismaClient } from "../../generated/prisma/client.js";

export interface GetCopilotHistoryParams {
  userId: string;
  limit?: number;
}

export interface CopilotHistoryMessage {
  id: string;
  role: string;
  content: string;
  tools: string[] | null;
  createdAt: Date;
}

export interface CopilotHistoryPendingAction {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  summary: string;
  status: string;
  createdAt: Date;
}

export interface CopilotHistoryResult {
  messages: CopilotHistoryMessage[];
  pendingActions: CopilotHistoryPendingAction[];
}

const DEFAULT_LIMIT = 50;

export function createGetCopilotHistory(db: PrismaClient) {
  return async function getCopilotHistory(
    params: GetCopilotHistoryParams
  ): Promise<CopilotHistoryResult> {
    const limit = params.limit ?? DEFAULT_LIMIT;

    const rows = await db.message.findMany({
      where: { userId: params.userId, channel: "copilot" },
      orderBy: { createdAt: "asc" },
      take: limit
    });

    const pending = await db.copilotPendingAction.findMany({
      where: { userId: params.userId },
      orderBy: { createdAt: "asc" }
    });

    return {
      messages: rows.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        tools: m.tools ? (JSON.parse(m.tools) as string[]) : null,
        createdAt: m.createdAt
      })),
      pendingActions: pending.map((p) => ({
        id: p.id,
        toolName: p.toolName,
        args: JSON.parse(p.argsJson) as Record<string, unknown>,
        summary: p.summary,
        status: p.status,
        createdAt: p.createdAt
      }))
    };
  };
}
