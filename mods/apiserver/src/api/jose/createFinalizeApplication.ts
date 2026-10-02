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
 *
 * A business outside the covered provinces is closed like the website closes
 * it: REJECTED as a system decision (OUT_OF_COVERAGE_AREA), whatever outcome
 * José asked for, and whether it was a draft or already submitted. José has
 * just told the person we don't serve their province; it must not wait in the
 * reviewers' queue.
 */
import type { DbClient, LoanApplication, NormalizedApplication } from "@mikro/common";
import { isOutOfCoverageArea, normalizeApplication } from "@mikro/common";
import type { ToolResult } from "@mikro/agents";
import { logger } from "../../logger.js";
import { createCancelApplicationJobs } from "../../follow-up/index.js";
import { OUT_OF_COVERAGE_AREA } from "../applications/createUpsertApplication.js";
import { missingApplicationFields } from "./missingFields.js";

interface CoverageDeps {
  /** Provinces Mikro lends in (`applications.coveredProvinces`). */
  coveredProvinces?: readonly string[];
  /** Records the system's `application.rejected` feed event. */
  recordOutOfArea?: (application: LoanApplication) => Promise<void>;
}

/** Statuses José may still close as out of area (nobody has taken it yet). */
const OPEN_FOR_INTAKE = new Set(["DRAFT", "RECEIVED"]);

export function createFinalizeApplication(
  client: DbClient,
  upsertApplication: (input: NormalizedApplication) => Promise<unknown>,
  coverage: CoverageDeps = {}
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

      if (
        coverage.coveredProvinces &&
        OPEN_FOR_INTAKE.has(existing.status) &&
        isOutOfCoverageArea(existing.province, coverage.coveredProvinces)
      ) {
        const now = new Date();
        const rejected = await client.loanApplication.update({
          where: { id: existing.id },
          data: {
            status: "REJECTED",
            decidedById: null,
            decidedAt: now,
            rejectionReason: OUT_OF_COVERAGE_AREA,
            intakeClosedAt: existing.intakeClosedAt ?? now,
            submittedAt: existing.submittedAt ?? now
          }
        });
        createCancelApplicationJobs(client)(existing.id).catch((err: Error) => {
          logger.error("jose finalizeApplication: failed to cancel follow-up jobs", {
            sessionId,
            error: err.message
          });
        });
        coverage.recordOutOfArea?.(rejected).catch((err: Error) => {
          logger.error("jose finalizeApplication: failed to record out-of-area event", {
            sessionId,
            error: err.message
          });
        });
        logger.info("jose finalizeApplication: rejected, out of coverage area", {
          sessionId,
          province: existing.province
        });
        return {
          success: true,
          message: "Solicitud cerrada: el negocio está fuera de la zona de cobertura",
          data: { finalized: true, outcome: "out_of_zone" }
        };
      }

      // Already submitted (José kept asking the remaining fields, openspec
      // jose-keep-gathering): finalizing only ends his questions. It never
      // abandons or re-submits a submitted application.
      if (existing.status !== "DRAFT") {
        if (!existing.intakeClosedAt) {
          await client.loanApplication.update({
            where: { id: existing.id },
            data: { intakeClosedAt: new Date() }
          });
        }
        logger.info("jose finalizeApplication: intake closed on a submitted application", {
          sessionId,
          status: existing.status,
          outcome
        });
        return {
          success: true,
          message: "La solicitud ya está enviada; no hay más preguntas",
          data: { finalized: true, outcome: "intake_closed" }
        };
      }

      if (outcome === "abandoned") {
        await client.loanApplication.update({
          where: { id: existing.id },
          data: { status: "ABANDONED" }
        });
        const cancelJobs = createCancelApplicationJobs(client);
        cancelJobs(existing.id).catch((err: Error) => {
          logger.error("jose finalizeApplication: failed to cancel follow-up jobs", {
            sessionId,
            error: err.message
          });
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

      // What is still missing, so José never tells someone their information
      // is complete when it isn't.
      return {
        success: true,
        message: "Solicitud finalizada",
        data: {
          finalized: true,
          outcome: "complete",
          missingFields: missingApplicationFields(existing)
        }
      };
    } catch (err) {
      logger.error("jose finalizeApplication failed", { sessionId, error: (err as Error).message });
      return { success: false, message: (err as Error).message };
    }
  };
}
