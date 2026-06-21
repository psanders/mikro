/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { randomUUID } from "crypto";
import { applicationPayloadSchema, normalizeApplication, scoreApplication } from "@mikro/common";
import type { CreateApplicationInput, DbClient, LoanApplication } from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Reviewer-initiated create: build a fresh LoanApplication in DRAFT status from
 * a field patch entered in the dashboard modal. A UUID sessionId is generated
 * server-side. Runs the same normalize + score pipeline as updateApplication.
 */
export function createCreateApplication(client: DbClient) {
  return async (input: CreateApplicationInput): Promise<LoanApplication> => {
    const sessionId = randomUUID();
    const payload = applicationPayloadSchema.parse({ sessionId, ...input.patch });
    const normalized = normalizeApplication(payload);
    const result = scoreApplication(normalized);

    const writeData = {
      status: "RECEIVED" as const,
      source: "MANUAL" as const,
      lastSection: null,
      firstName: normalized.firstName,
      lastName: normalized.lastName,
      phone: normalized.phone,
      idNumber: normalized.idNumber,
      dateOfBirth: normalized.dateOfBirth,
      maritalStatus: normalized.maritalStatus,
      businessType: normalized.businessType,
      businessName: normalized.businessName,
      requestedAmount: normalized.requestedAmount,
      purpose: normalized.purpose,
      requestedTermWeeks: normalized.requestedTermWeeks,
      province: normalized.province,
      homeAddress: normalized.homeAddress,
      rawData: normalized.rawData,
      scoreData: result,
      score: Math.round(result.isc),
      riskBand: result.risk_band,
      recommendation: result.recommendation,
      scoredAt: new Date()
    };

    const app = await client.loanApplication.upsert({
      where: { sessionId },
      create: { sessionId, ...writeData },
      update: writeData
    });
    logger.verbose("loan application created manually", {
      id: app.id,
      status: "RECEIVED",
      source: "MANUAL",
      score: Math.round(result.isc)
    });
    return app;
  };
}
