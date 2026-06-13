/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { applicationPayloadSchema, normalizeApplication } from "@mikro/common";
import type { LoanApplication, NormalizedApplication } from "@mikro/common";
import { logger } from "../../logger.js";

interface Deps {
  /** Upsert a normalized application by its `sessionId` (shared with the website path). */
  upsertApplication: (normalized: NormalizedApplication) => Promise<LoanApplication>;
  /** Most-recent application sessionId for a canonical E.164 phone, or null. */
  findLatestApplicationByPhone: (phone: string) => Promise<{ sessionId: string } | null>;
}

/**
 * Persist a prospect intake Flow submission (WhatsApp). Validates and normalizes
 * the payload, then applies WhatsApp-only phone correlation: if an application
 * already exists for the sender's canonical phone (e.g. one a reviewer created
 * with the promo), the submission reuses that `sessionId` so it folds into the
 * same row instead of spawning a new `wa-<messageId>` one. With no match, it
 * upserts under the incoming sessionId, preserving today's behavior. The public
 * website endpoint does not use this path — it stays a strict upsert-by-sessionId.
 */
export function createSubmitApplicationFromFlow(deps: Deps) {
  return async (payload: Record<string, string | boolean>): Promise<void> => {
    const parsed = applicationPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      logger.warn("intake flow: invalid payload", {
        sessionId: typeof payload.sessionId === "string" ? payload.sessionId : undefined,
        issues: parsed.error.issues.length
      });
      return;
    }
    const normalized = normalizeApplication(parsed.data);
    if (normalized.phone) {
      const existing = await deps.findLatestApplicationByPhone(normalized.phone);
      if (existing) normalized.sessionId = existing.sessionId;
    }
    await deps.upsertApplication(normalized);
  };
}
