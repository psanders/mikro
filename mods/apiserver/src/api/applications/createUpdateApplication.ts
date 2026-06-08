/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { applicationPayloadSchema, normalizeApplication, scoreApplication } from "@mikro/common";
import type { DbClient, LoanApplication, UpdateApplicationInput } from "@mikro/common";
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
 * Reviewer edit: merge a field patch over the application's rawData, re-derive
 * the stable columns, recompute the score, and persist — leaving status, review
 * audit, contract, and conversion links untouched. Locked once CONVERTED.
 */
export function createUpdateApplication(client: DbClient) {
  return async (input: UpdateApplicationInput): Promise<LoanApplication> => {
    const app = await loadByRef(client, input);
    if (app.status === "CONVERTED") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A converted application is locked and cannot be edited."
      });
    }

    const existing = (app.rawData as Record<string, unknown> | null) ?? {};
    const merged = { ...existing, ...input.patch };
    const payload = applicationPayloadSchema.parse({ sessionId: app.sessionId, ...merged });
    const normalized = normalizeApplication(payload);
    const result = scoreApplication(normalized);

    const updated = await client.loanApplication.update({
      where: { id: app.id },
      data: {
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
    logger.verbose("loan application edited", { id: app.id, score: Math.round(result.isc) });
    return updated;
  };
}
