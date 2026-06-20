/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared helper: build a score input from raw app fields and simulate ISC
 * with partial: false (so disqualifying flags and bucket weights are correct).
 */
import type { LoanApplication } from "@mikro/common";
import { scoreInput } from "@mikro/common";

export function computeSimulatedIsc(
  app: Partial<LoanApplication>,
  rawData: Record<string, unknown>
): { simulatedIsc: number; isOutOfZone: boolean; isCriticalBusiness: boolean } {
  const scoreResult = scoreInput({
    name: `${app.firstName ?? ""} ${app.lastName ?? ""}`.trim() || "",
    age: null,
    idNumber: app.idNumber ?? "",
    phone: (app.phone as string | null) ?? "",
    businessType: app.businessType ?? "",
    businessName: app.businessName ?? "",
    province: app.province ?? "",
    monthlySales: rawData["monthlySales"] ? String(rawData["monthlySales"]) : null,
    requestedAmount: app.requestedAmount ?? null,
    requestedTermWeeks: app.requestedTermWeeks ?? null,
    businessAge: (rawData["businessAge"] as string | null) ?? null,
    formalization: (rawData["formalization"] as string | null) ?? null,
    locationType: (rawData["locationType"] as string | null) ?? null,
    employeeCount: (rawData["employeeCount"] as string | null) ?? null,
    housingType: (rawData["housingType"] as string | null) ?? null,
    residenceTime: (rawData["residenceTime"] as string | null) ?? null,
    homeAddress: app.homeAddress ?? null,
    addressReference: (rawData["addressReference"] as string | null) ?? null,
    referenceName: (rawData["referenceName"] as string | null) ?? null,
    referencePhone: (rawData["referencePhone"] as string | null) ?? null,
    spouseName: (rawData["spouseName"] as string | null) ?? null,
    spousePhone: (rawData["spousePhone"] as string | null) ?? null,
    businessPhone: (rawData["businessPhone"] as string | null) ?? null,
    purpose: app.purpose ?? null,
    maritalStatus: app.maritalStatus ?? null,
    partial: false
  });

  const flagCodes = new Set(scoreResult.flags.map((f) => f.code));
  return {
    simulatedIsc: Math.round(scoreResult.isc),
    isOutOfZone: flagCodes.has("OUT_OF_ZONE"),
    isCriticalBusiness: flagCodes.has("CRITICAL_BUSINESS")
  };
}
