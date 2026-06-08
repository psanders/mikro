/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { scoreApplication } from "@mikro/common";
import type { DbClient, LoanApplication, NormalizedApplication } from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function that upserts a loan application by `sessionId`. The website
 * form streams partial autosaves and a final submit under one session, so each
 * post updates the same row. A completed submission (`partial: false`) sets
 * status `RECEIVED` and stamps `submittedAt`; a partial keeps it `DRAFT`.
 *
 * Scoring is deterministic, so it runs on every write (partial and complete) and
 * is persisted alongside the row — it is not a manual step or a pipeline stage.
 *
 * @param client - The database client
 * @returns A function that upserts and returns the application
 */
export function createUpsertApplication(client: DbClient) {
  return async (input: NormalizedApplication): Promise<LoanApplication> => {
    const status = input.partial ? "DRAFT" : "RECEIVED";
    const result = scoreApplication(input);
    const data = {
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
      create: { sessionId: input.sessionId, ...data },
      update: data
    });

    logger.verbose("loan application upserted", {
      sessionId: input.sessionId,
      status,
      id: application.id,
      score: data.score,
      riskBand: data.riskBand,
      recommendation: data.recommendation
    });
    return application;
  };
}
