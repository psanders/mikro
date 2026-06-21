/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { scoreApplication } from "@mikro/common";
import type {
  ApplicationSource,
  DbClient,
  LoanApplication,
  NormalizedApplication
} from "@mikro/common";
import { logger } from "../../logger.js";

interface Deps {
  /** Called after a RECEIVED upsert from an external source (FORM or WHATSAPP). */
  scheduleFollowUpJob?: (applicationId: string) => Promise<void>;
}

/**
 * Creates a function that upserts a loan application by `sessionId`. The website
 * form streams partial autosaves and a final submit under one session, so each
 * post updates the same row. A completed submission (`partial: false`) sets
 * status `RECEIVED` and stamps `submittedAt`; a partial keeps it `DRAFT`.
 *
 * Scoring is deterministic, so it runs on every write (partial and complete) and
 * is persisted alongside the row — it is not a manual step or a pipeline stage.
 *
 * When `scheduleFollowUpJob` is provided, a NUDGE follow-up timer is scheduled
 * whenever an external (non-MANUAL) application reaches RECEIVED status.
 *
 * @param client - The database client
 * @param deps - Optional dependencies (follow-up scheduling)
 */
export function createUpsertApplication(client: DbClient, deps: Deps = {}) {
  return async (
    input: NormalizedApplication & { source?: ApplicationSource }
  ): Promise<LoanApplication> => {
    const status = input.partial ? "DRAFT" : "RECEIVED";
    const result = scoreApplication(input);
    const source: ApplicationSource = input.source ?? "FORM";
    const updateData = {
      status: status as "DRAFT" | "RECEIVED",
      lastSection: input.lastSection,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      idNumber: input.idNumber,
      dateOfBirth: input.dateOfBirth,
      maritalStatus: input.maritalStatus,
      businessType: input.businessType,
      businessName: input.businessName,
      requestedAmount: input.requestedAmount,
      purpose: input.purpose,
      requestedTermWeeks: input.requestedTermWeeks,
      province: input.province,
      homeAddress: input.homeAddress,
      rawData: input.rawData,
      scoreData: result,
      score: Math.round(result.isc),
      riskBand: result.risk_band,
      recommendation: result.recommendation,
      scoredAt: new Date(),
      submittedAt: input.partial ? null : new Date()
    };

    const application = await client.loanApplication.upsert({
      where: { sessionId: input.sessionId },
      create: { sessionId: input.sessionId, source, ...updateData },
      update: updateData
    });

    logger.verbose("loan application upserted", {
      sessionId: input.sessionId,
      status,
      source,
      id: application.id,
      score: updateData.score,
      riskBand: updateData.riskBand,
      recommendation: updateData.recommendation
    });

    if (status === "RECEIVED" && source !== "MANUAL" && deps.scheduleFollowUpJob) {
      deps.scheduleFollowUpJob(application.id).catch((err: Error) => {
        logger.error("failed to schedule follow-up job", {
          applicationId: application.id,
          error: err.message
        });
      });
    }

    return application;
  };
}
