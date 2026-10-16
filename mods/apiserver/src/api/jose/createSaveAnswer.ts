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
import { DECLINED_FIELDS_KEY, missingFieldsOf } from "./missingFields.js";

const VALID_KEYS = new Set<string>(APPLICATION_CONTENT_KEYS);

// Fields that must be valid phone numbers when provided. José re-asks on failure
// instead of persisting a malformed number that an asesor cannot dial.
const PHONE_KEYS = new Set<string>(PHONE_FIELDS);

/**
 * Placeholder answers ("N/A", "no tengo", "ninguno", "0000000000"). Saved as a
 * value, one would mark the field answered with nothing in it.
 */
const FILLER =
  /^(n\/?a|no aplica|no tiene|no tengo( (pareja|referencia|telefono|numero|ninguno|nada))?|no hay|ningun[oa]?|nada|none|null|sin (pareja|referencia|telefono|numero|dato)|-+|\.+|x+|0+)$/;

function isFiller(value: string): boolean {
  const key = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s.]+$/, "")
    .trim();
  return key === "" || FILLER.test(key);
}

/**
 * Optional contacts a person may simply not have (no business phone, no
 * reference, no partner). A filler answer for one of these records that the
 * person declined it, so it leaves `missingFields` and José never asks again.
 * Other fields keep their answer as given ("ninguno" is a valid employee count).
 */
const DECLINABLE_KEYS = new Set<string>([
  "businessPhone",
  "referenceName",
  "referencePhone",
  "spouseName",
  "spousePhone",
  "addressReference"
]);

/** Identity and address answers every applicant has: filler is never accepted. */
const REQUIRED_TEXT_KEYS = new Set<string>([
  "firstName",
  "lastName",
  "idNumber",
  "homeAddress",
  "businessName"
]);

const DECLINED_REASON =
  "Anotado que no tiene este dato; no lo vuelvas a preguntar y sigue con el siguiente campo.";

/** Fields the person said they don't have, as stored in rawData. */
function declinedOf(raw: Record<string, unknown>): string[] {
  const value = raw[DECLINED_FIELDS_KEY];
  return Array.isArray(value) ? value.filter((k): k is string => typeof k === "string") : [];
}

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
    const declined: string[] = [];

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
      if (DECLINABLE_KEYS.has(key) && isFiller(strVal)) {
        declined.push(key);
        invalidReasons[key] = DECLINED_REASON;
        continue;
      }
      if (REQUIRED_TEXT_KEYS.has(key) && isFiller(strVal)) {
        invalid.push(key);
        invalidReasons[key] = "Respuesta sin dato; pide el dato real, no guardes un relleno.";
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

    if (saved.length === 0 && declined.length === 0) {
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

      const storedRaw = (existing?.rawData as Record<string, unknown>) ?? {};
      // A field answered now is no longer declined; a newly declined one is added.
      const declinedFields = [
        ...new Set([...declinedOf(storedRaw).filter((k) => !(k in patch)), ...declined])
      ];
      const existingRaw: Record<string, unknown> = { ...storedRaw };
      if (declinedFields.length > 0) existingRaw[DECLINED_FIELDS_KEY] = declinedFields;
      else delete existingRaw[DECLINED_FIELDS_KEY];
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
        message:
          saved.length > 0
            ? `Campos guardados: ${saved.join(", ")}`
            : `Sin dato (no preguntar más): ${declined.join(", ")}`,
        data: {
          saved,
          declined,
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
