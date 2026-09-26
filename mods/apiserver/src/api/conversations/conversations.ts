/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Persisted WhatsApp CX transcripts (issue #299). The agents write every turn
 * through `createRecordConversationTurn` and read their memory back through
 * `createGetConversationHistory`; the application panel reads one
 * applicant's conversation; ctl lists turns for evals and deletes a phone's
 * transcript on request.
 *
 * Retention: turns are kept until someone asks for their deletion
 * (`ctl conversations:delete <phone>`). There is no automatic expiry.
 */
import {
  recordConversationTurnSchema,
  listConversationTurnsSchema,
  getApplicationConversationSchema,
  deleteConversationSchema,
  validatePhone,
  withErrorHandlingAndValidation,
  type RecordConversationTurnInput,
  type GetApplicationConversationInput,
  type DeleteConversationInput,
  type ConversationToolCall
} from "@mikro/common";
import type { z } from "zod/v4";
import type { Message, ConversationHistoryQuery } from "@mikro/agents";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { logger } from "../../logger.js";

type TurnClient = Pick<PrismaClient, "conversationTurn">;

/**
 * How much of the guest/applicant/customer thread an agent remembers: the
 * latest turns, and none older than the window. Code constants on purpose — a
 * mikro.json key that lands before its release crashes the rollback.
 */
export const CX_HISTORY_TURNS = 40;
export const CX_HISTORY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** José's intake is short (7 replies max); this only bounds a runaway thread. */
export const PROSPECT_HISTORY_TURNS = 100;

/** A stored turn as the UI and ctl see it: tool calls parsed. */
export interface ConversationTurnView {
  id: number;
  phone: string;
  role: "INBOUND" | "AGENT" | "SYSTEM";
  content: string;
  profile: string | null;
  agentName: string | null;
  agentVersion: string | null;
  toolCalls: ConversationToolCall[];
  hasImage: boolean;
  applicationId: string | null;
  customerId: string | null;
  waMessageId: string | null;
  createdAt: Date;
}

interface TurnRow {
  id: number;
  phone: string;
  role: string;
  content: string;
  profile: string | null;
  agentName: string | null;
  agentVersion: string | null;
  toolCalls: string | null;
  hasImage: boolean;
  applicationId: string | null;
  customerId: string | null;
  waMessageId: string | null;
  createdAt: Date;
}

function parseToolCalls(raw: string | null): ConversationToolCall[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ConversationToolCall[]) : [];
  } catch {
    return [];
  }
}

export function toTurnView(row: TurnRow): ConversationTurnView {
  return {
    ...row,
    role: row.role as ConversationTurnView["role"],
    toolCalls: parseToolCalls(row.toolCalls)
  };
}

/** Normalize to E.164 like the router does; keep the raw value if it does not parse. */
function e164OrRaw(phone: string): string {
  try {
    return validatePhone(phone);
  } catch {
    return phone;
  }
}

export function createRecordConversationTurn(db: TurnClient) {
  const fn = async (input: RecordConversationTurnInput): Promise<{ id: string }> => {
    const turn = await db.conversationTurn.create({
      data: {
        phone: e164OrRaw(input.phone),
        role: input.role,
        content: input.content,
        profile: input.profile ?? null,
        agentName: input.agentName ?? null,
        agentVersion: input.agentVersion ?? null,
        toolCalls: input.toolCalls?.length ? JSON.stringify(input.toolCalls) : null,
        hasImage: input.hasImage ?? false,
        applicationId: input.applicationId ?? null,
        customerId: input.customerId ?? null,
        waMessageId: input.waMessageId ?? null
      },
      select: { id: true }
    });
    // The agents treat ids as opaque strings (see ConversationHistoryQuery.excludeId).
    return { id: String(turn.id) };
  };
  return withErrorHandlingAndValidation(fn, recordConversationTurnSchema);
}

/**
 * An agent's memory, oldest first, in LLM message shape. `cx` is the
 * guest/applicant/customer thread for the phone (every profile but PROSPECT,
 * SYSTEM replies included so the agent knows what the app already said);
 * `prospect` is José's INBOUND/AGENT turns for one application, which José's
 * turn counters are derived from.
 */
export function createGetConversationHistory(db: TurnClient) {
  return async (query: ConversationHistoryQuery): Promise<Message[]> => {
    const phone = e164OrRaw(query.phone);
    const excludeId = query.excludeId ? Number(query.excludeId) : NaN;
    const exclude = Number.isInteger(excludeId) ? { id: { not: excludeId } } : {};
    const where =
      query.scope === "prospect"
        ? {
            phone,
            profile: "PROSPECT",
            applicationId: query.applicationId,
            role: { in: ["INBOUND", "AGENT"] },
            ...exclude
          }
        : {
            phone,
            OR: [{ profile: null }, { profile: { not: "PROSPECT" } }],
            createdAt: { gte: new Date(Date.now() - CX_HISTORY_MAX_AGE_MS) },
            ...exclude
          };
    const rows = await db.conversationTurn.findMany({
      where,
      orderBy: { id: "desc" },
      take: query.scope === "prospect" ? PROSPECT_HISTORY_TURNS : CX_HISTORY_TURNS
    });
    return rows.reverse().map((row) => {
      const toolCalls = parseToolCalls(row.toolCalls);
      return {
        role: row.role === "INBOUND" ? ("user" as const) : ("assistant" as const),
        content: row.content,
        ...(toolCalls.length > 0 ? { tools_executed: toolCalls } : {})
      };
    });
  };
}

/** Phones an application's conversation could be under (stored E.164). */
async function applicationPhone(
  db: Pick<PrismaClient, "loanApplication">,
  applicationId: string
): Promise<string | null> {
  const app = await db.loanApplication.findUnique({
    where: { id: applicationId },
    select: { phone: true }
  });
  return app?.phone ? e164OrRaw(app.phone) : null;
}

/**
 * Turns matching the filters, oldest first (ctl export). `applicationId`
 * matches the application's phone, so a conversation from before the
 * application existed (the guest asking about requirements) is included.
 */
export function createListConversationTurns(
  db: Pick<PrismaClient, "conversationTurn" | "loanApplication" | "customer">
) {
  const fn = async (
    filters: z.infer<typeof listConversationTurnsSchema>
  ): Promise<ConversationTurnView[]> => {
    const phones: string[] = [];
    if (filters.phone) phones.push(e164OrRaw(filters.phone));
    if (filters.applicationId) {
      const phone = await applicationPhone(db, filters.applicationId);
      if (!phone) return [];
      phones.push(phone);
    }
    if (filters.customerId) {
      const customer = await db.customer.findUnique({
        where: { id: filters.customerId },
        select: { phone: true }
      });
      if (!customer?.phone) return [];
      phones.push(e164OrRaw(customer.phone));
    }
    // Several identity filters must agree on one phone.
    if (new Set(phones).size > 1) return [];

    const rows = await db.conversationTurn.findMany({
      where: {
        ...(phones[0] ? { phone: phones[0] } : {}),
        ...(filters.profile ? { profile: filters.profile } : {}),
        ...(filters.agentName ? { agentName: filters.agentName } : {}),
        ...(filters.agentVersion ? { agentVersion: filters.agentVersion } : {}),
        ...(filters.since || filters.until
          ? {
              createdAt: {
                ...(filters.since ? { gte: filters.since } : {}),
                ...(filters.until ? { lt: filters.until } : {})
              }
            }
          : {})
      },
      orderBy: { id: "desc" },
      take: filters.limit
    });
    return rows.reverse().map(toTurnView);
  };
  return withErrorHandlingAndValidation(fn, listConversationTurnsSchema);
}

export interface ApplicationConversation {
  phone: string | null;
  turns: ConversationTurnView[];
  /** Hand-offs to a person for this phone; the UI marks where each began. */
  handoffs: Array<{ id: string; reason: string; openedAt: Date; closedAt: Date | null }>;
}

/**
 * The WhatsApp conversation behind an application (the panel's
 * "Conversación · WhatsApp" section): every turn for the applicant's phone,
 * oldest first, plus the hand-offs. Staff replies typed in Chatwoot are not
 * here — the panel links to Chatwoot for those.
 */
export function createGetApplicationConversation(
  db: Pick<PrismaClient, "conversationTurn" | "loanApplication" | "conversationHandoff">
) {
  const fn = async (input: GetApplicationConversationInput): Promise<ApplicationConversation> => {
    const phone = await applicationPhone(db, input.applicationId);
    if (!phone) return { phone: null, turns: [], handoffs: [] };
    const [rows, handoffs] = await Promise.all([
      db.conversationTurn.findMany({
        where: { phone },
        orderBy: { id: "asc" },
        take: 500
      }),
      db.conversationHandoff.findMany({
        where: { phone },
        orderBy: { openedAt: "asc" },
        select: { id: true, reason: true, openedAt: true, closedAt: true }
      })
    ]);
    return { phone, turns: rows.map(toTurnView), handoffs };
  };
  return withErrorHandlingAndValidation(fn, getApplicationConversationSchema);
}

/** Delete every turn for a phone (a person asked for their data to be removed). */
export function createDeleteConversation(db: TurnClient) {
  const fn = async (input: DeleteConversationInput): Promise<{ deleted: number }> => {
    const phone = e164OrRaw(input.phone);
    const { count } = await db.conversationTurn.deleteMany({ where: { phone } });
    logger.info("conversation transcript deleted", { phone, deleted: count });
    return { deleted: count };
  };
  return withErrorHandlingAndValidation(fn, deleteConversationSchema);
}
