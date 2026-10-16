/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Label stored INBOUND CX turns with the decision-model classifier (openspec
 * conversation-state D8): the backfill behind `mikro conversations:classify`
 * and the live labeler. Labels only — nothing here sends a message, touches
 * Chatwoot or changes an application.
 */
import {
  classifyConversationTurnsSchema,
  e164OrRaw,
  withErrorHandlingAndValidation,
  type ClassifyConversationTurnsInput
} from "@mikro/common";
import {
  classifyInbound,
  costOf,
  type Classification,
  type ClassifierTurn,
  type DecisionProvider
} from "@mikro/agents";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { logger } from "../../logger.js";

type TurnDb = Pick<PrismaClient, "conversationTurn">;

/** Inbound content the handler stores for media without text. */
const MEDIA_RE = /^\[(imagen|video|audio|unsupported|sticker|nota de voz|document|[a-z_]+)\]$/i;

interface TurnRow {
  id: number;
  phone: string;
  role: string;
  content: string;
  hasImage: boolean;
  failed: boolean;
  intent: string | null;
  createdAt: Date;
}

export interface ClassifiedTurn {
  id: number;
  phone: string;
  createdAt: Date;
  content: string;
  intent: string;
  confidence: number;
  predicates: Classification["predicates"] | null;
  model: string;
  inputTokens: number;
  latencyMs: number;
}

export interface ClassifyTurnsResult {
  classified: number;
  skipped: number;
  errors: number;
  dryRun: boolean;
  costUsd: number;
  turns: ClassifiedTurn[];
}

/** One stored turn's label columns, written from a classification. */
export function labelColumns(c: Classification) {
  return {
    intent: c.intent,
    intentConfidence: c.confidence,
    classification: JSON.stringify({ model: c.model, ...(c.predicates ?? {}) })
  };
}

/** The classifier's view of one stored turn. */
export function toClassifierTurn(row: Pick<TurnRow, "role" | "content">): ClassifierTurn {
  return { role: row.role as ClassifierTurn["role"], content: row.content };
}

export function isMediaTurn(row: Pick<TurnRow, "content" | "hasImage">): boolean {
  return row.hasImage || MEDIA_RE.test(row.content.trim());
}

export function createClassifyConversationTurns(db: TurnDb, provider: DecisionProvider) {
  const fn = async (input: ClassifyConversationTurnsInput): Promise<ClassifyTurnsResult> => {
    const rows = (await db.conversationTurn.findMany({
      where: {
        createdAt: { gte: input.since },
        ...(input.phone ? { phone: e164OrRaw(input.phone) } : {})
      },
      orderBy: { id: "asc" },
      select: {
        id: true,
        phone: true,
        role: true,
        content: true,
        hasImage: true,
        failed: true,
        intent: true,
        createdAt: true
      }
    })) as TurnRow[];

    // Each phone's thread in order; the classifier sees the turns before each message.
    const threads = new Map<string, TurnRow[]>();
    for (const row of rows) threads.set(row.phone, [...(threads.get(row.phone) ?? []), row]);

    const result: ClassifyTurnsResult = {
      classified: 0,
      skipped: 0,
      errors: 0,
      dryRun: input.dryRun,
      costUsd: 0,
      turns: []
    };
    for (const thread of threads.values()) {
      for (let i = 0; i < thread.length; i++) {
        const row = thread[i]!;
        if (row.role !== "INBOUND") continue;
        if (row.intent && !input.force) {
          result.skipped += 1;
          continue;
        }
        if (result.classified + result.errors >= input.limit) return result;
        const history = thread
          .slice(0, i)
          .filter((t) => !t.failed)
          .map(toClassifierTurn);
        try {
          const c = await classifyInbound(provider, {
            history,
            message: row.content,
            isMedia: isMediaTurn(row)
          });
          if (!input.dryRun) {
            await db.conversationTurn.update({ where: { id: row.id }, data: labelColumns(c) });
          }
          result.classified += 1;
          result.costUsd +=
            costOf({ model: c.model, inputTokens: c.inputTokens, outputTokens: 0 }) ?? 0;
          result.turns.push({
            id: row.id,
            phone: row.phone,
            createdAt: row.createdAt,
            content: row.content,
            intent: c.intent,
            confidence: c.confidence,
            predicates: c.predicates ?? null,
            model: c.model,
            inputTokens: c.inputTokens,
            latencyMs: c.latencyMs
          });
        } catch (err) {
          result.errors += 1;
          logger.warn("conversation classify failed", {
            turnId: row.id,
            error: (err as Error).message
          });
        }
      }
    }
    return result;
  };
  return withErrorHandlingAndValidation(fn, classifyConversationTurnsSchema);
}
