/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared helper for recording collection attempts (DB + structured log).
 * Eliminates the repeated try/catch, DB-write, and log pattern across processors.
 */

import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  CollectionChannel,
  CollectionAttemptType,
  CollectionAttemptStatus
} from "../generated/prisma/enums.js";
import {
  CollectionAttemptStatus as Status,
  CollectionChannel as Channel,
  CollectionAttemptType as AttemptType
} from "../generated/prisma/enums.js";
import { logger } from "../logger.js";

// Re-export enums for convenient single-import in processors
export { Status, Channel, AttemptType };

/** Common dependencies shared by all collection processors. */
export interface CollectionDeps {
  db: PrismaClient;
  sendWhatsAppTemplate: (params: {
    phone: string;
    templateName: string;
    languageCode: string;
    bodyParameters?: string[];
  }) => Promise<{ messages?: Array<{ id: string }> }>;
}

/** Identifies the member + loan for a collection attempt. */
export interface CollectionTarget {
  member: { id: string; name: string; phone: string };
  loan: { id: string; loanId: number };
}

/** Parameters for recording a collection attempt. */
export interface RecordAttemptParams {
  target: CollectionTarget;
  channel: CollectionChannel;
  type: CollectionAttemptType;
  status: CollectionAttemptStatus;
  messageId?: string | null;
  templateName?: string | null;
  notes?: string | null;
  missedPayments?: number;
}

/**
 * Record a collection attempt: write a DB row and emit a structured log line.
 */
export async function recordCollectionAttempt(
  db: PrismaClient,
  params: RecordAttemptParams
): Promise<void> {
  const { target, channel, type, status, messageId, templateName, notes, missedPayments } = params;

  await db.collectionAttempt.create({
    data: {
      channel,
      type,
      status,
      messageId: messageId ?? undefined,
      templateName: templateName ?? undefined,
      notes: notes ?? undefined,
      memberId: target.member.id,
      loanId: target.loan.id
    }
  });

  logger.info("collection event", {
    loanId: target.loan.loanId,
    memberId: target.member.id,
    memberPhone: target.member.phone,
    channel,
    type,
    status,
    messageId: messageId ?? null,
    templateName: templateName ?? null,
    missedPayments: missedPayments ?? null,
    error: status === Status.FAILED ? notes : null
  });
}

/**
 * Execute a collection action, record the result, and return whether it succeeded.
 *
 * @param action - async function that performs the send/call and returns a messageId
 * @param db - Prisma client
 * @param params - channel, type, target, templateName, missedPayments
 * @returns true if the action succeeded
 */
export async function executeCollectionAction(
  action: () => Promise<string | null>,
  db: PrismaClient,
  params: {
    target: CollectionTarget;
    channel: CollectionChannel;
    type: CollectionAttemptType;
    templateName?: string | null;
    missedPayments?: number;
  }
): Promise<boolean> {
  try {
    const messageId = await action();
    await recordCollectionAttempt(db, {
      ...params,
      status: Status.SENT,
      messageId
    });
    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await recordCollectionAttempt(db, {
      ...params,
      status: Status.FAILED,
      notes: errorMessage
    });
    return false;
  }
}

/**
 * Check if collections dry run mode is active.
 * In dry run mode, actions are logged but no messages/calls are sent and no DB records are written.
 */
export function isDryRun(): boolean {
  return process.env.MIKRO_COLLECTIONS_DRY_RUN === "true";
}

/**
 * Log a dry-run action (what would have happened).
 */
export function logDryRun(params: {
  channel: string;
  type: string;
  target: CollectionTarget;
  templateName?: string | null;
  bodyParameters?: string[];
  missedPayments?: number;
}): void {
  logger.info("collection dry run (no action taken)", {
    loanId: params.target.loan.loanId,
    memberId: params.target.member.id,
    memberPhone: params.target.member.phone,
    channel: params.channel,
    type: params.type,
    templateName: params.templateName ?? null,
    bodyParameters: params.bodyParameters ?? [],
    missedPayments: params.missedPayments ?? null
  });
}
