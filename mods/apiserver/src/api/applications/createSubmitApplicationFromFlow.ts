/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { applicationPayloadSchema, normalizeApplication } from "@mikro/common";
import type { ApplicationSource, LoanApplication, NormalizedApplication } from "@mikro/common";
import { logger } from "../../logger.js";
import type { FindPriorApplication } from "./createFindPriorApplication.js";
import { OUT_OF_COVERAGE_AREA } from "./createUpsertApplication.js";

interface Deps {
  /** Upsert a normalized application by its `sessionId` (shared with the website path). */
  upsertApplication: (
    normalized: NormalizedApplication & {
      source?: ApplicationSource;
      whatsappUserId?: string;
      whatsappUsername?: string;
    }
  ) => Promise<LoanApplication>;
  /** Most-recent application sessionId for a canonical E.164 phone, or null. */
  findLatestApplicationByPhone: (phone: string) => Promise<{ sessionId: string } | null>;
  /** Most-recent application for a WhatsApp BSUID (username sender), or null. */
  findLatestApplicationByWhatsAppUserId?: (
    bsuid: string
  ) => Promise<{ sessionId: string; phone: string | null } | null>;
  /** The same person's other applications (issue #302). */
  findPriorApplication?: FindPriorApplication;
}

/**
 * What became of a Flow submission, so the WhatsApp reply can say it:
 * `received`, `cooldown` (rejected less than 30 days ago; `reapplyFrom` is
 * when they may apply again) or `in_process` (they already have one being
 * handled). `invalid` when the payload didn't parse.
 */
export type FlowSubmitResult =
  | { outcome: "received" | "in_process" | "invalid" }
  | { outcome: "cooldown"; reapplyFrom: Date; outOfArea?: boolean };

/** Who submitted the Flow, beyond the phone: set for a WhatsApp username sender. */
export interface FlowSubmitter {
  whatsappUserId?: string;
  whatsappUsername?: string;
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
  return async (
    payload: Record<string, string | boolean>,
    submitter: FlowSubmitter = {}
  ): Promise<FlowSubmitResult> => {
    const parsed = applicationPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      logger.warn("intake flow: invalid payload", {
        sessionId: typeof payload.sessionId === "string" ? payload.sessionId : undefined,
        issues: parsed.error.issues.length
      });
      return { outcome: "invalid" };
    }
    const normalized = normalizeApplication(parsed.data);
    if (normalized.phone) {
      const existing = await deps.findLatestApplicationByPhone(normalized.phone);
      if (existing) normalized.sessionId = existing.sessionId;
    } else if (submitter.whatsappUserId && deps.findLatestApplicationByWhatsAppUserId) {
      // A username sender has no phone in the webhook: fold into the
      // application already linked to their BSUID, keeping its phone.
      const existing = await deps.findLatestApplicationByWhatsAppUserId(submitter.whatsappUserId);
      if (existing) {
        normalized.sessionId = existing.sessionId;
        normalized.phone = existing.phone;
      }
    }
    // The Flow already folded into the latest application for this phone; any
    // OTHER application of the same person (phone or cédula) still decides.
    const prior = deps.findPriorApplication
      ? await deps.findPriorApplication({
          phone: normalized.phone,
          idNumber: normalized.idNumber,
          sessionId: normalized.sessionId
        })
      : null;
    if (prior?.kind === "cooldown") {
      logger.info("intake flow: rejected recently, no new application", {
        sessionId: normalized.sessionId,
        reapplyFrom: prior.reapplyFrom.toISOString()
      });
      return {
        outcome: "cooldown",
        reapplyFrom: prior.reapplyFrom,
        ...(prior.rejectionReason === OUT_OF_COVERAGE_AREA ? { outOfArea: true } : {})
      };
    }
    if (prior?.kind === "in_process") {
      logger.info("intake flow: person already has an application in process", {
        sessionId: normalized.sessionId,
        applicationId: prior.applicationId
      });
      return { outcome: "in_process" };
    }
    if (prior?.kind === "draft") normalized.sessionId = prior.sessionId;
    await deps.upsertApplication({
      ...normalized,
      source: "WHATSAPP",
      ...(submitter.whatsappUserId
        ? {
            whatsappUserId: submitter.whatsappUserId,
            whatsappUsername: submitter.whatsappUsername
          }
        : {})
    });
    return { outcome: "received" };
  };
}
