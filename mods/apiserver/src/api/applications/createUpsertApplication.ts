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
   * `rejectionReason` {@link OUT_OF_COVERAGE_AREA} and gets no follow-up. Only the
   * website intake passes this; the WhatsApp paths build their instance without
   * it and are unaffected.
   */
  coveredProvinces?: readonly string[];
  /**
   * Records the `application.received` feed event. Called once, when a row
   * first becomes RECEIVED (not on repeated final submits of the same row).
   */
  recordReceived?: (application: LoanApplication) => Promise<void>;
  /** Records the system's `application.rejected` for an out-of-area submission. */
  recordOutOfArea?: (application: LoanApplication) => Promise<void>;
}

/**
 * Statuses a person owns: intake writes (late autosaves, beacons, a repeated
 * WhatsApp Flow submission) must not touch them, or they would silently undo
 * an assignment, a decision, or evidence already gathered.
 */
const OWNED_BY_REVIEW = new Set(["IN_REVIEW", "PENDING_DECISION", "APPROVED"]);

/**
 * Closed with a history worth keeping. A new submission under the same session
 * (a returning borrower matched by phone on the WhatsApp path) starts a fresh
 * application instead of overwriting the old one.
 */
const CLOSED_WITH_HISTORY = new Set(["CONVERTED", "REJECTED"]);

/** `rejectionReason` stamped on an application auto-rejected for its province. */
export const OUT_OF_COVERAGE_AREA = "OUT_OF_COVERAGE_AREA" as const;

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
 * `decidedById` null, `rejectionReason` OUT_OF_COVERAGE_AREA) and schedules no
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
        ? { decidedById: null, decidedAt: new Date(), rejectionReason: OUT_OF_COVERAGE_AREA }
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

    const existing = await client.loanApplication.findFirst({
      where: { sessionId: input.sessionId }
    });
    if (existing && OWNED_BY_REVIEW.has(existing.status)) {
      logger.warn("intake write ignored: application is under review", {
        sessionId: input.sessionId,
        id: existing.id,
        status: existing.status,
        partial: input.partial
      });
      return existing;
    }
    // A fresh application for a returning applicant whose previous one is closed.
    const sessionId =
      existing && CLOSED_WITH_HISTORY.has(existing.status)
        ? `${input.sessionId}-r${Date.now().toString(36)}`
        : input.sessionId;
    // Never walk a submitted application back to DRAFT: a partial write on a
    // RECEIVED row (a stray beacon) keeps it RECEIVED and just updates the data.
    if (existing?.status === "RECEIVED" && sessionId === input.sessionId && status === "DRAFT") {
      updateData.status = "RECEIVED";
      updateData.submittedAt = existing.submittedAt ?? new Date();
    }

    const application = await client.loanApplication.upsert({
      where: { sessionId },
      create: { sessionId, source, ...updateData },
      update: updateData
    });
    const becameReceived =
      application.status === "RECEIVED" &&
      !(existing?.status === "RECEIVED" && sessionId === input.sessionId);
    const becameOutOfArea =
      outOfArea && application.status === "REJECTED" && !existing?.rejectionReason;
    if (becameOutOfArea && deps.recordOutOfArea) {
      deps.recordOutOfArea(application).catch((err: Error) => {
        logger.error("failed to record out-of-area rejection", {
          applicationId: application.id,
          error: err.message
        });
      });
    }
    if (becameReceived && deps.recordReceived) {
      deps.recordReceived(application).catch((err: Error) => {
        logger.error("failed to record application.received", {
          applicationId: application.id,
          error: err.message
        });
      });
    }

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
