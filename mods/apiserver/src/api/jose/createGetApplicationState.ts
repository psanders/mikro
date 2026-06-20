/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * José tool: getApplicationState — fetches the current loan application from DB,
 * computes a score simulation with partial: false, and returns filled/missing
 * fields plus disqualifying flags for the LLM to reason over.
 */
import type { DbClient } from "@mikro/common";
import { APPLICATION_CONTENT_KEYS } from "@mikro/common";
import type { ToolResult } from "@mikro/agents";
import { logger } from "../../logger.js";
import { computeSimulatedIsc } from "./computeScore.js";

export function createGetApplicationState(client: DbClient) {
  return async (context?: Record<string, unknown>): Promise<ToolResult> => {
    const sessionId = context?.sessionId as string | undefined;
    if (!sessionId) {
      return { success: false, message: "No sessionId in context" };
    }

    try {
      const app = await client.loanApplication.findFirst({
        where: { sessionId }
      });

      if (!app) {
        return { success: false, message: `Application not found for sessionId: ${sessionId}` };
      }

      // Merge stable columns + rawData into one flat map
      const rawData = (app.rawData as Record<string, unknown>) ?? {};
      const allFields: Record<string, unknown> = {
        firstName: app.firstName,
        lastName: app.lastName,
        phone: app.phone,
        idNumber: app.idNumber,
        dateOfBirth: app.dateOfBirth ? String(app.dateOfBirth) : null,
        maritalStatus: app.maritalStatus,
        businessType: app.businessType,
        businessName: app.businessName,
        requestedAmount: app.requestedAmount,
        purpose: app.purpose,
        requestedTermWeeks: app.requestedTermWeeks,
        province: app.province,
        homeAddress: app.homeAddress,
        ...rawData
      };

      const filledFields: Record<string, unknown> = {};
      const missingFields: string[] = [];

      for (const key of APPLICATION_CONTENT_KEYS) {
        const val = allFields[key];
        if (val !== null && val !== undefined && val !== "") {
          filledFields[key] = val;
        } else {
          missingFields.push(key);
        }
      }

      // Simulate score with partial: false
      const { simulatedIsc, isOutOfZone, isCriticalBusiness } = computeSimulatedIsc(app, rawData);

      logger.verbose("jose getApplicationState", {
        sessionId,
        filledCount: Object.keys(filledFields).length,
        missingCount: missingFields.length,
        simulatedIsc,
        isOutOfZone,
        isCriticalBusiness
      });

      return {
        success: true,
        message: "Estado de solicitud obtenido",
        data: {
          sessionId,
          filledFields,
          missingFields,
          simulatedIsc,
          isOutOfZone,
          isCriticalBusiness
        }
      };
    } catch (err) {
      logger.error("jose getApplicationState failed", {
        sessionId,
        error: (err as Error).message
      });
      return { success: false, message: (err as Error).message };
    }
  };
}
