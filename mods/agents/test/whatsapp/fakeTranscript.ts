/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * In-memory stand-in for the apiserver's persisted transcript
 * (recordConversationTurn / getConversationHistory), with the same history
 * rules: `cx` is every non-PROSPECT turn for the phone, `prospect` is José's
 * INBOUND/AGENT turns for one application; only turns stored before the
 * current one are read, and failed sends are left out.
 */
import sinon from "sinon";
import type {
  ConversationTurnRecord,
  ConversationHistoryQuery
} from "../../src/conversations/index.js";
import type { Message } from "../../src/llm/types.js";

export interface StoredTurn extends ConversationTurnRecord {
  id: string;
  createdAt: Date;
}

/** A seed turn may carry its own time (default: now). */
export type SeedTurn = ConversationTurnRecord & { createdAt?: Date };

export function createFakeTranscript(seed: SeedTurn[] = []) {
  let seq = 0;
  const turns: StoredTurn[] = seed.map((t) => ({
    ...t,
    id: String(++seq),
    createdAt: t.createdAt ?? new Date()
  }));

  const recordConversationTurn = sinon.spy(async (turn: ConversationTurnRecord) => {
    const stored = { ...turn, id: String(++seq), createdAt: new Date() };
    turns.push(stored);
    return { id: stored.id };
  });

  const getConversationHistory = sinon.spy(
    async (query: ConversationHistoryQuery): Promise<Message[]> =>
      turns
        .filter((t) => t.phone === query.phone && !t.failed)
        .filter((t) => !query.excludeId || Number(t.id) < Number(query.excludeId))
        .filter((t) =>
          query.scope === "prospect"
            ? t.profile === "PROSPECT" &&
              t.applicationId === query.applicationId &&
              t.role !== "SYSTEM"
            : t.profile !== "PROSPECT"
        )
        .map((t) => ({
          role: t.role === "INBOUND" ? ("user" as const) : ("assistant" as const),
          content: t.content,
          timestamp: t.createdAt,
          ...(t.toolCalls ? { tools_executed: t.toolCalls } : {})
        }))
  );

  return { turns, recordConversationTurn, getConversationHistory };
}
