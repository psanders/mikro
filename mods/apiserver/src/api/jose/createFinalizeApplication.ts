/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * José tool: finalizeApplication — closes the prospect's application.
 * Persistence only: the closing/goodbye message is José's own reply text
 * (single source of truth) so the prospect never receives two messages, and
 * rejections aren't followed by a generic "completed" message.
 *
 * outcome "complete" (default) marks the application ready for review
 * (partial: false → RECEIVED). outcome "abandoned" marks it ABANDONED — used
 * when the prospect declines ("no me interesa") or goes silent — so the ops
 * dashboard never shows a declined lead as a finished application.
 */
import type { DbClient, NormalizedApplication } from "@mikro/common";
import { normalizeApplication } from "@mikro/common";
import type { ToolResult } from "@mikro/agents";
import { logger } from "../../logger.js";

export function createFinalizeApplication(
  client: DbClient,
  upsertApplication: (input: NormalizedApplication) => Promise<unknown>
) {
  return async (
    args: Record<string, unknown>,
    context?: Record<string, unknown>
  ): Promise<ToolResult> => {
    const sessionId = context?.sessionId as string | undefined;
    const outcome = args?.outcome === "abandoned" ? "abandoned" : "complete";

    if (!sessionId) {
      return { success: false, message: "No sessionId in context" };
    }

    try {
      const existing = await client.loanApplication.findFirst({
        where: { sessionId }
      });

      if (!existing) {
        return { success: false, message: `Application not found: ${sessionId}` };
      }

      if (outcome === "abandoned") {
        await client.loanApplication.update({
          where: { id: existing.id },
          data: { status: "ABANDONED" }
        });
        logger.info("jose finalizeApplication: application abandoned", { sessionId });
        return {
          success: true,
          message: "Solicitud marcada como abandonada",
          data: { finalized: true, outcome: "abandoned" }
        };
      }

      const existingRaw = (existing.rawData as Record<string, unknown>) ?? {};

      const payload = {
        sessionId,
        partial: false,
        ...existingRaw,
        firstName: existing.firstName ?? undefined,
        lastName: existing.lastName ?? undefined,
        phone: existing.phone ?? undefined,
        idNumber: existing.idNumber ?? undefined,
        maritalStatus: existing.maritalStatus ?? undefined,
        businessType: existing.businessType ?? undefined,
        businessName: existing.businessName ?? undefined,
        requestedAmount:
          existing.requestedAmount != null ? String(existing.requestedAmount) : undefined,
        purpose: existing.purpose ?? undefined,
        requestedTermWeeks:
          existing.requestedTermWeeks != null ? String(existing.requestedTermWeeks) : undefined,
        province: existing.province ?? undefined,
        homeAddress: existing.homeAddress ?? undefined
      };

      const normalized = normalizeApplication(payload);
      await upsertApplication(normalized);

      logger.info("jose finalizeApplication: application finalized", { sessionId });

      return {
        success: true,
        message: "Solicitud finalizada",
        data: { finalized: true, outcome: "complete" }
      };
    } catch (err) {
      logger.error("jose finalizeApplication failed", { sessionId, error: (err as Error).message });
      return { success: false, message: (err as Error).message };
    }
  };
}
