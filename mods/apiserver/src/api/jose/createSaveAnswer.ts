/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * José tool: saveAnswer — validates field values and upserts them into the
 * loan application (partial: true). Returns simulatedIsc so José can decide
 * whether to finalize without needing a separate getApplicationState call.
 */
import type { DbClient, NormalizedApplication } from "@mikro/common";
import {
  APPLICATION_CONTENT_KEYS,
  MARITAL_STATUSES,
  PHONE_FIELDS,
  applicationPayloadSchema,
  isDrPhone,
  maritalStatusEnum,
  normalizeApplication
} from "@mikro/common";
import type { ToolResult } from "@mikro/agents";
import { logger } from "../../logger.js";
import { computeSimulatedIsc } from "./computeScore.js";
import { missingFieldsOf } from "./missingFields.js";

const VALID_KEYS = new Set<string>(APPLICATION_CONTENT_KEYS);

// Fields that must be valid phone numbers when provided. José re-asks on failure
// instead of persisting a malformed number that an asesor cannot dial.
const PHONE_KEYS = new Set<string>(PHONE_FIELDS);

/**
 * Placeholder answers ("N/A", "no tengo", "ninguno", "0000000000"): never a real
 * value for any field. Saving one marks the field answered with nothing in it,
 * so José is told to move on instead.
 */
const FILLER =
  /^(n\/?a|no aplica|no tiene|no tengo.*|no hay|ningun[oa]?|nada|none|null|sin .*|-+|\.+|x+|0+)$/;

function isFiller(value: string): boolean {
  const key = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s.]+$/, "")
    .trim();
  return key === "" || FILLER.test(key);
}

const FILLER_REASON =
  "No aplica: no lo guardes. Si no tiene ese dato, sigue con el siguiente campo.";

export function createSaveAnswer(
  client: DbClient,
  upsertApplication: (input: NormalizedApplication) => Promise<unknown>
) {
  return async (
    args: Record<string, unknown>,
    context?: Record<string, unknown>
  ): Promise<ToolResult> => {
    const sessionId = context?.sessionId as string | undefined;
    if (!sessionId) return { success: false, message: "No sessionId in context" };

    const fields = args["fields"] as Record<string, unknown> | undefined;
    if (!fields || typeof fields !== "object") {
      return { success: false, message: "fields argument is required" };
    }

    // Filter to known keys only
    const saved: string[] = [];
    const invalid: string[] = [];
    const invalidReasons: Record<string, string> = {};
    const patch: Record<string, string> = {};

    for (const [key, val] of Object.entries(fields)) {
      if (!VALID_KEYS.has(key)) {
        invalid.push(key);
        continue;
      }
      if (val === null || val === undefined || val === "") {
        invalid.push(key);
        continue;
      }
      const strVal = String(val).trim();
      if (key === "maritalStatus") {
        const status = maritalStatusEnum.safeParse(strVal).data;
        if (!status) {
          invalid.push(key);
          invalidReasons[key] =
            `Estado civil inválido; usa uno de: ${MARITAL_STATUSES.join(", ")}.`;
          continue;
        }
        patch[key] = status;
        saved.push(key);
        continue;
      }
      if (isFiller(strVal)) {
        invalid.push(key);
        invalidReasons[key] = FILLER_REASON;
        continue;
      }
      if (PHONE_KEYS.has(key) && !isDrPhone(strVal)) {
        invalid.push(key);
        invalidReasons[key] = "Número de teléfono inválido; pide el número completo (10 dígitos).";
        continue;
      }
      patch[key] = strVal;
      saved.push(key);
    }

    if (saved.length === 0) {
      return {
        success: false,
        message: "No valid fields to save",
        data: { saved, invalid, invalidReasons }
      };
    }

    try {
      // Load current application to merge
      const existing = await client.loanApplication.findFirst({
        where: { sessionId }
      });

      const existingRaw = (existing?.rawData as Record<string, unknown>) ?? {};
      const mergedPayload = {
        sessionId,
        partial: true,
        ...existingRaw,
        ...patch,
        firstName: patch["firstName"] ?? existing?.firstName ?? undefined,
        lastName: patch["lastName"] ?? existing?.lastName ?? undefined,
        phone: patch["phone"] ?? existing?.phone ?? undefined,
        idNumber: patch["idNumber"] ?? existing?.idNumber ?? undefined,
        maritalStatus: patch["maritalStatus"] ?? existing?.maritalStatus ?? undefined,
        businessType: patch["businessType"] ?? existing?.businessType ?? undefined,
        businessName: patch["businessName"] ?? existing?.businessName ?? undefined,
        requestedAmount:
          patch["requestedAmount"] ??
          (existing?.requestedAmount != null ? String(existing.requestedAmount) : undefined),
        purpose: patch["purpose"] ?? existing?.purpose ?? undefined,
        requestedTermWeeks:
          patch["requestedTermWeeks"] ??
          (existing?.requestedTermWeeks != null ? String(existing.requestedTermWeeks) : undefined),
        province: patch["province"] ?? existing?.province ?? undefined,
        homeAddress: patch["homeAddress"] ?? existing?.homeAddress ?? undefined
      };

      const parsed = applicationPayloadSchema.safeParse(mergedPayload);
      if (!parsed.success) {
        logger.warn("jose saveAnswer: payload validation failed", {
          sessionId,
          issues: parsed.error.issues
        });
        return {
          success: false,
          message: "Validation failed",
          data: { saved: [], invalid: Object.keys(patch) }
        };
      }

      const normalized = normalizeApplication(parsed.data);
      await upsertApplication(normalized);

      // Compute simulated ISC on merged state so José can decide to finalize
      const mergedRaw = { ...existingRaw, ...patch };
      const mergedApp = {
        firstName: patch["firstName"] ?? existing?.firstName ?? null,
        lastName: patch["lastName"] ?? existing?.lastName ?? null,
        phone: patch["phone"] ?? existing?.phone ?? null,
        idNumber: patch["idNumber"] ?? existing?.idNumber ?? null,
        businessType: patch["businessType"] ?? existing?.businessType ?? null,
        businessName: patch["businessName"] ?? existing?.businessName ?? null,
        requestedAmount:
          patch["requestedAmount"] != null
            ? Number(patch["requestedAmount"])
            : (existing?.requestedAmount ?? null),
        requestedTermWeeks:
          patch["requestedTermWeeks"] != null
            ? Number(patch["requestedTermWeeks"])
            : (existing?.requestedTermWeeks ?? null),
        province: patch["province"] ?? existing?.province ?? null,
        homeAddress: patch["homeAddress"] ?? existing?.homeAddress ?? null,
        purpose: patch["purpose"] ?? existing?.purpose ?? null,
        maritalStatus: patch["maritalStatus"] ?? existing?.maritalStatus ?? null
      };

      const { simulatedIsc, isOutOfZone, isCriticalBusiness } = computeSimulatedIsc(
        mergedApp,
        mergedRaw
      );

      // Compute missingFields so agent knows what to ask next without a separate getApplicationState call
      const allMerged: Record<string, unknown> = {
        ...mergedApp,
        ...mergedRaw,
        dateOfBirth: patch["dateOfBirth"] ?? existing?.dateOfBirth ?? mergedRaw["dateOfBirth"],
        maritalStatus: mergedApp.maritalStatus,
        requestedAmount: mergedApp.requestedAmount,
        requestedTermWeeks: mergedApp.requestedTermWeeks
      };
      const missingFields = missingFieldsOf(allMerged);

      // A submitted application whose form is now complete: José is done asking
      // (openspec jose-keep-gathering), so the applicant agent answers next.
      const intakeComplete = existing?.status === "RECEIVED" && missingFields.length === 0;
      if (intakeComplete && existing && !existing.intakeClosedAt) {
        await client.loanApplication.update({
          where: { id: existing.id },
          data: { intakeClosedAt: new Date() }
        });
      }

      logger.verbose("jose saveAnswer: fields saved", { sessionId, saved, simulatedIsc });
      return {
        success: true,
        message: `Campos guardados: ${saved.join(", ")}`,
        data: {
          saved,
          invalid,
          invalidReasons,
          simulatedIsc,
          isOutOfZone,
          isCriticalBusiness,
          missingFields,
          submitted: existing?.status === "RECEIVED",
          intakeComplete
        }
      };
    } catch (err) {
      logger.error("jose saveAnswer failed", { sessionId, error: (err as Error).message });
      return { success: false, message: (err as Error).message };
    }
  };
}
