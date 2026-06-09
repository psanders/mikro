/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";
import { paymentFrequencyEnum } from "./loan.js";
import { safeOptionalDate } from "./dates.js";
import { MAX_ATTACHMENT_SIZE_BYTES } from "./accounting.js";

/**
 * Public loan-application (solicitud) intake.
 *
 * The website form posts English field keys that match our stable columns 1:1,
 * plus a handful of fields that live only in `rawData` (spouse, reference,
 * housing, extended business detail). The form streams partial autosaves and a
 * final submit under one `sessionId`. Values arrive as the form's formatted
 * display strings (e.g. requestedAmount "50,000", requestedTermWeeks "18
 * semanas", phone "(829) 871-7987"), so normalization parses rather than
 * translates. Everything is best-effort and lenient: a partial submission
 * missing most fields still normalizes (missing -> null).
 */

// Content fields promoted to stable columns.
const STABLE_KEYS = [
  "firstName",
  "lastName",
  "phone",
  "idNumber",
  "dateOfBirth",
  "maritalStatus",
  "businessType",
  "businessName",
  "requestedAmount",
  "purpose",
  "requestedTermWeeks",
  "province",
  "homeAddress"
] as const;

// Content fields kept only in `rawData`.
const RAW_ONLY_KEYS = [
  "businessAge",
  "monthlySales",
  "locationType",
  "formalization",
  "employeeCount",
  "businessPhone",
  "spouseName",
  "spousePhone",
  "referenceName",
  "referencePhone",
  "housingType",
  "residenceTime",
  "addressReference"
] as const;

const ALL_CONTENT_KEYS = [...STABLE_KEYS, ...RAW_ONLY_KEYS] as const;

/**
 * Lenient schema for the incoming form payload. All content fields are optional
 * strings (partials send only a few); only `sessionId` is required since it is
 * the upsert key.
 */
export const applicationPayloadSchema = z
  .object({
    sessionId: z.string().min(1, "sessionId is required"),
    partial: z.boolean().optional(),
    lastSection: z.string().optional(),
    ...Object.fromEntries(ALL_CONTENT_KEYS.map((k) => [k, z.string().optional()]))
  })
  // Tolerate fields we don't know about yet (form drift) — they still land in rawData.
  .loose();

export type ApplicationPayload = z.infer<typeof applicationPayloadSchema>;

/** Stable, typed fields extracted from a submission. */
export interface NormalizedApplicationFields {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  idNumber: string | null;
  dateOfBirth: Date | null;
  maritalStatus: string | null;
  businessType: string | null;
  businessName: string | null;
  requestedAmount: number | null;
  purpose: string | null;
  requestedTermWeeks: number | null;
  province: string | null;
  homeAddress: string | null;
}

/** Result of normalizing a payload: stable fields + the full content as rawData. */
export interface NormalizedApplication extends NormalizedApplicationFields {
  sessionId: string;
  partial: boolean;
  lastSection: string | null;
  rawData: Record<string, unknown>;
}

// ---- parse helpers (lenient: return null rather than throw) ----

function trimToNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

/** "50,000" / "RD$ 50,000" -> 50000; empty/invalid -> null. */
function parseCurrency(v: unknown): number | null {
  const s = trimToNull(v);
  if (!s) return null;
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/** "18 semanas" -> 18; empty/invalid -> null. */
function parseTermWeeks(v: unknown): number | null {
  const s = trimToNull(v);
  if (!s) return null;
  const m = s.match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * "(829) 871-7987" -> "+18298717987". Lenient, non-throwing: a 10-digit NANP
 * number gets a "1" country code; an 11-digit number starting with 1 is used
 * as-is; anything else returns null.
 */
function parsePhone(v: unknown): string | null {
  const s = trimToNull(v);
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** ISO date string ("2004-06-18") -> Date; empty/invalid -> null. */
function parseDate(v: unknown): Date | null {
  const s = trimToNull(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Parse a validated form payload into stable typed fields + a rawData buffer.
 * Pure (no DB). Reusable by the optional CSV backfill.
 */
export function normalizeApplication(payload: ApplicationPayload): NormalizedApplication {
  const raw = payload as Record<string, unknown>;

  // rawData keeps every content field provided (and any unknown extras), as sent.
  const rawData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === "sessionId" || key === "partial" || key === "lastSection") continue;
    if (value !== undefined) rawData[key] = value;
  }

  return {
    sessionId: payload.sessionId,
    partial: payload.partial ?? false,
    lastSection: trimToNull(payload.lastSection),
    rawData,
    firstName: trimToNull(raw.firstName),
    lastName: trimToNull(raw.lastName),
    phone: parsePhone(raw.phone),
    idNumber: trimToNull(raw.idNumber),
    dateOfBirth: parseDate(raw.dateOfBirth),
    maritalStatus: trimToNull(raw.maritalStatus),
    businessType: trimToNull(raw.businessType),
    businessName: trimToNull(raw.businessName),
    requestedAmount: parseCurrency(raw.requestedAmount),
    purpose: trimToNull(raw.purpose),
    requestedTermWeeks: parseTermWeeks(raw.requestedTermWeeks),
    province: trimToNull(raw.province),
    homeAddress: trimToNull(raw.homeAddress)
  };
}

/** The canonical English content keys, exported for the form + tests to share. */
export const APPLICATION_STABLE_KEYS = STABLE_KEYS;
export const APPLICATION_RAW_ONLY_KEYS = RAW_ONLY_KEYS;
export const APPLICATION_CONTENT_KEYS = ALL_CONTENT_KEYS;

// ---- internal read-procedure input schemas ----

export const applicationStatusEnum = z.enum([
  "DRAFT",
  "RECEIVED",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "SIGNED",
  "CONVERTED"
]);

export const listApplicationsSchema = z.object({
  status: applicationStatusEnum.optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

export const getApplicationSchema = z
  .object({
    id: z.string().optional(),
    sessionId: z.string().optional()
  })
  .refine((v) => Boolean(v.id || v.sessionId), {
    message: "Provide either id or sessionId"
  });

export type ListApplicationsInput = z.infer<typeof listApplicationsSchema>;
export type GetApplicationInput = z.infer<typeof getApplicationSchema>;

// ---- review (human decision) mutation input schemas ----

// Identifies an application by id or sessionId (at least one required).
const applicationRef = {
  id: z.string().optional(),
  sessionId: z.string().optional()
};
const requireRef = (v: { id?: string; sessionId?: string }) => Boolean(v.id || v.sessionId);
const refMessage = { message: "Provide either id or sessionId" };

export const claimApplicationSchema = z.object(applicationRef).refine(requireRef, refMessage);

export const approveApplicationSchema = z
  .object({ ...applicationRef, note: z.string().max(2000).optional() })
  .refine(requireRef, refMessage);

export const rejectApplicationSchema = z
  .object({
    ...applicationRef,
    reason: z.string().trim().min(1, "A rejection reason is required").max(2000)
  })
  .refine(requireRef, refMessage);

export const reopenApplicationSchema = z
  .object({ ...applicationRef, note: z.string().max(2000).optional() })
  .refine(requireRef, refMessage);

/**
 * Generate the loan contract PDF for an application. The applicant identity
 * comes from the application; the negotiated terms (principal from the request,
 * plus installments/amount/frequency/start) and the debtor's gender are
 * supplied by the reviewer at the post-approval "Generar contrato" step.
 */
export const generateApplicationContractSchema = z
  .object({
    ...applicationRef,
    gender: z.enum(["M", "F"]),
    installments: z.number().int().positive(),
    installmentAmount: z.number().positive(),
    frequency: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]),
    startDate: z.string().min(1),
    /** Optional overrides if the application data is incomplete. */
    maritalStatus: z.string().trim().max(40).optional(),
    occupation: z.string().trim().max(80).optional()
  })
  .refine(requireRef, refMessage);

export type ClaimApplicationInput = z.infer<typeof claimApplicationSchema>;
export type ApproveApplicationInput = z.infer<typeof approveApplicationSchema>;
export type RejectApplicationInput = z.infer<typeof rejectApplicationSchema>;
export type ReopenApplicationInput = z.infer<typeof reopenApplicationSchema>;
export type GenerateApplicationContractInput = z.infer<typeof generateApplicationContractSchema>;

// ---- review transition validation ----

type Status = z.infer<typeof applicationStatusEnum>;

/** The review/pipeline action being attempted (drives the allowed source statuses). */
export type ReviewAction = "claim" | "approve" | "reject" | "reopen" | "sign" | "convert";

const REVIEW_TRANSITIONS: Record<ReviewAction, { from: Status[]; to: Status }> = {
  claim: { from: ["RECEIVED"], to: "IN_REVIEW" },
  approve: { from: ["RECEIVED", "IN_REVIEW"], to: "APPROVED" },
  reject: { from: ["RECEIVED", "IN_REVIEW"], to: "REJECTED" },
  reopen: { from: ["APPROVED", "REJECTED"], to: "IN_REVIEW" },
  sign: { from: ["APPROVED"], to: "SIGNED" },
  convert: { from: ["SIGNED"], to: "CONVERTED" }
};

/**
 * Resolve the target status for a review action given the current status, or
 * return null if the transition is not allowed.
 */
export function resolveReviewTransition(action: ReviewAction, current: Status): Status | null {
  const rule = REVIEW_TRANSITIONS[action];
  return rule.from.includes(current) ? rule.to : null;
}

// ---- signing + conversion (Phase 3) ----

export const getApplicationContractSchema = z.object(applicationRef).refine(requireRef, refMessage);

export const uploadSignedContractSchema = z
  .object({
    ...applicationRef,
    originalName: z.string().min(1).max(255),
    mimeType: z.literal("application/pdf", { error: "Contract must be a PDF" }),
    /** Base64-encoded PDF contents (no data: prefix). */
    dataBase64: z
      .string()
      .min(1, "Contract content is required")
      .refine((b) => Math.ceil((b.length * 3) / 4) <= MAX_ATTACHMENT_SIZE_BYTES, {
        message: "Contract exceeds the maximum allowed size"
      })
  })
  .refine(requireRef, refMessage);

export const convertApplicationSchema = z
  .object({
    ...applicationRef,
    principal: z.number().positive("Principal must be positive"),
    termLength: z.number().int().positive("Term length must be a positive integer"),
    paymentAmount: z.number().positive("Payment amount must be positive"),
    paymentFrequency: paymentFrequencyEnum,
    startingDate: safeOptionalDate,
    moraRate: z.number().min(0).max(1, "moraRate must be between 0 and 1").optional(),
    assignedCollectorId: z.uuid({ error: "Invalid collector ID" }).optional()
  })
  .refine(requireRef, refMessage);

export type GetApplicationContractInput = z.infer<typeof getApplicationContractSchema>;
export type UploadSignedContractInput = z.infer<typeof uploadSignedContractSchema>;
export type ConvertApplicationInput = z.infer<typeof convertApplicationSchema>;

// ---- edit (reviewer correction) ----

// A patch of editable content fields (English keys → display-string values),
// merged over the application's rawData and re-normalized + re-scored.
export const updateApplicationSchema = z
  .object({
    ...applicationRef,
    patch: z.record(z.string(), z.string()).default({})
  })
  .refine(requireRef, refMessage);

export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;

// ---- identity document images (cédula front/back) ----

/** Which side of the cédula an image represents. */
export const idImageSideEnum = z.enum(["FRONT", "BACK"]);

const idImageMimeType = z.enum(["image/jpeg", "image/png", "image/webp"], {
  error: "ID image must be a JPEG, PNG, or WebP"
});

/**
 * Upload one side of the applicant's cédula. A static image (no OCR/extraction);
 * stored on disk, metadata persisted on the application. Available before the
 * prospect is converted to a customer.
 */
export const uploadIdImageSchema = z
  .object({
    ...applicationRef,
    side: idImageSideEnum,
    originalName: z.string().min(1).max(255),
    mimeType: idImageMimeType,
    /** Base64-encoded image contents (no data: prefix). */
    dataBase64: z
      .string()
      .min(1, "Image content is required")
      .refine((b) => Math.ceil((b.length * 3) / 4) <= MAX_ATTACHMENT_SIZE_BYTES, {
        message: "Image exceeds the maximum allowed size"
      })
  })
  .refine(requireRef, refMessage);

export const getIdImageSchema = z
  .object({ ...applicationRef, side: idImageSideEnum })
  .refine(requireRef, refMessage);

export type IdImageSide = z.infer<typeof idImageSideEnum>;
export type UploadIdImageInput = z.infer<typeof uploadIdImageSchema>;
export type GetIdImageInput = z.infer<typeof getIdImageSchema>;

// ---- manual purge (hard delete) ----

/**
 * Permanently delete a loan application (manual purge of an abandoned/dead flow).
 * Irreversible: the row is removed and any stored contract file is unlinked.
 * Not allowed for CONVERTED applications (they own a real Customer + Loan).
 */
export const deleteApplicationSchema = z.object(applicationRef).refine(requireRef, refMessage);

export type DeleteApplicationInput = z.infer<typeof deleteApplicationSchema>;
