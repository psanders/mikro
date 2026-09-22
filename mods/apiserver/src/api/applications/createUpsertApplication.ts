/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { isOutOfCoverageArea, scoreApplication } from "@mikro/common";
import type {
  ApplicationAttribution,
  ApplicationSource,
  DbClient,
  LoanApplication,
  NormalizedApplication
} from "@mikro/common";
import { logger } from "../../logger.js";

interface Deps {
  /** Called after a RECEIVED upsert from an external source (FORM or WHATSAPP). */
  scheduleFollowUpJob?: (applicationId: string) => Promise<void>;
  /** Records the ad in the local name catalog. Only called when one is attributed. */
  recordMetaAd?: (attribution: ApplicationAttribution) => Promise<unknown>;
  /**
   * Provinces Mikro lends in (`applications.coveredProvinces`). When set, a
   * completed submission from any other province is stored REJECTED with
   * `reviewNote` {@link OUT_OF_COVERAGE_AREA} and gets no follow-up. Only the
   * website intake passes this; the WhatsApp paths build their instance without
   * it and are unaffected.
   */
  coveredProvinces?: readonly string[];
}

/** `reviewNote` stamped on an application auto-rejected for its province. */
export const OUT_OF_COVERAGE_AREA = "OUT_OF_COVERAGE_AREA";

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
 * When `coveredProvinces` is provided, a completed submission whose province is
 * set and not covered is stored as REJECTED instead (system decision:
 * `reviewedById` null, `reviewNote` OUT_OF_COVERAGE_AREA) and schedules no
 * follow-up. Partial autosaves never reject — the applicant may still change
 * the province before submitting.
 *
 * Ad attribution (`input.attribution`) is written only when the submission
 * carried it: a form streams several autosaves under one session and only the
 * ones whose page still had the URL parameters can say which ad this was, so an
 * absent value means "unknown", never "organic".
 *
 * @param client - The database client
 * @param deps - Optional dependencies (follow-up scheduling)
 */
export function createUpsertApplication(client: DbClient, deps: Deps = {}) {
  return async (
    input: NormalizedApplication & { source?: ApplicationSource }
  ): Promise<LoanApplication> => {
    const outOfArea =
      !input.partial &&
      deps.coveredProvinces !== undefined &&
      isOutOfCoverageArea(input.province, deps.coveredProvinces);
    const status = input.partial ? "DRAFT" : outOfArea ? "REJECTED" : "RECEIVED";
    const result = scoreApplication(input);
    const source: ApplicationSource = input.source ?? "FORM";
    const updateData = {
      status: status as "DRAFT" | "RECEIVED" | "REJECTED",
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
      submittedAt: input.partial ? null : new Date(),
      ...(outOfArea
        ? { reviewedById: null, reviewedAt: new Date(), reviewNote: OUT_OF_COVERAGE_AREA }
        : {}),
      // Spread, not fixed keys: omitting them leaves the stored ad alone, while
      // `adId: null` would erase it on the next autosave.
      ...(input.attribution
        ? {
            adId: input.attribution.adId,
            adsetId: input.attribution.adsetId,
            campaignId: input.attribution.campaignId
          }
        : {})
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
      recommendation: updateData.recommendation,
      adId: application.adId
    });

    // Learn the ad's name for the reports. Not awaited and never fatal: the
    // catalog is reporting metadata, and an applicant's submission must not fail
    // because we could not write down what their ad is called.
    if (input.attribution && deps.recordMetaAd) {
      deps.recordMetaAd(input.attribution).catch((err: Error) => {
        logger.error("failed to record meta ad", {
          adId: input.attribution?.adId,
          error: err.message
        });
      });
    }

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
