/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  applicationPayloadSchema,
  normalizeApplication,
  resolveReviewTransition,
  scoreApplication
} from "@mikro/common";
import type { DbClient, LoanApplication, PromoteApplicationInput } from "@mikro/common";
import { TRPCError } from "@trpc/server";
import { logger } from "../../logger.js";

async function loadByRef(
  client: DbClient,
  ref: { id?: string; sessionId?: string }
): Promise<LoanApplication> {
  const app = ref.id
    ? await client.loanApplication.findUnique({ where: { id: ref.id } })
    : await client.loanApplication.findFirst({ where: { sessionId: ref.sessionId! } });
  if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Loan application not found" });
  return app;
}

/**
 * Promote a DRAFT into the active queue (-> RECEIVED), stamping submittedAt as if
 * the applicant had completed the form. Re-normalizes rawData and recomputes the
 * score (a DRAFT may have been seeded/saved without one) so the new RECEIVED row
 * is fully scored. Reviewer-driven: used to finish a partial submission by phone.
 */
export function createPromoteApplication(client: DbClient) {
  return async (input: PromoteApplicationInput, reviewerId: string): Promise<LoanApplication> => {
    const app = await loadByRef(client, input);
    const to = resolveReviewTransition("promote", app.status);
    if (!to) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Only a draft can be promoted; this application is ${app.status}.`
      });
    }

    const existing = (app.rawData as Record<string, unknown> | null) ?? {};
    const payload = applicationPayloadSchema.parse({ sessionId: app.sessionId, ...existing });
    const normalized = normalizeApplication(payload);
    const result = scoreApplication(normalized);

    const updated = await client.loanApplication.update({
      where: { id: app.id },
      data: {
        status: to,
        submittedAt: new Date(),
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
      }
    });
    logger.verbose("loan application promoted", {
      id: app.id,
      score: Math.round(result.isc),
      reviewerId
    });
    return updated;
  };
}
