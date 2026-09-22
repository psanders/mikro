/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Single definition of the solicitud form's sections and required fields,
 * mirroring the `required` attributes on site/src/pages/SolicitudPage.tsx.
 * Kept in @mikro/common so the site (progress tracking, the completion
 * beacon) and the apiserver (the ad-quality report's form-completeness
 * numbers) read the same shape instead of two copies drifting apart —
 * exactly the gap issue #280's report cannot see on its own, since Meta's own
 * attribution reports zero.
 *
 * "Completeness" only means something for a DRAFT: a submitted application
 * already has every required field (the browser refuses to submit the form
 * otherwise), so completeness there is always 1. The real signal is how far
 * someone got before they left — which is why this module also exports the
 * autosave payload builder the site's toggle handler and its leave-page
 * beacon both call, so the two paths can never send different shapes.
 *
 * Pure module: no DOM, no Zod, no server dependency. Safe to import from the
 * browser bundle (site, dashboard) as well as the apiserver.
 */

/** One section of the form, in display order, with its required content keys. */
export interface ApplicationSectionDef {
  id: string;
  requiredFields: readonly string[];
}

// Order and required fields mirror SECTION_DEFS + the `required` props in
// site/src/pages/SolicitudPage.tsx. spouseName/spousePhone (familiar) and
// addressReference (vivienda) are optional there, so they are left out here.
export const APPLICATION_SECTIONS: readonly ApplicationSectionDef[] = [
  {
    id: "personal",
    requiredFields: ["firstName", "lastName", "phone", "idNumber", "dateOfBirth", "maritalStatus"]
  },
  {
    id: "negocio",
    requiredFields: [
      "businessType",
      "businessName",
      "businessAge",
      "monthlySales",
      "locationType",
      "formalization",
      "employeeCount",
      "businessPhone"
    ]
  },
  {
    id: "credito",
    requiredFields: ["requestedAmount", "purpose", "requestedTermWeeks"]
  },
  {
    id: "familiar",
    requiredFields: ["referenceName", "referencePhone"]
  },
  {
    id: "vivienda",
    requiredFields: ["housingType", "residenceTime", "homeAddress", "province"]
  }
] as const;

/** Ordered section ids, for callers that only need the order (e.g. the ctl histogram). */
export const APPLICATION_SECTION_IDS: readonly string[] = APPLICATION_SECTIONS.map((s) => s.id);

const TOTAL_REQUIRED_FIELDS = APPLICATION_SECTIONS.reduce(
  (sum, section) => sum + section.requiredFields.length,
  0
);

/** A field counts as answered when it is a non-empty string after trimming. */
function isFilled(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export interface FormProgress {
  /** How many sections the applicant reached, 0-5. 0 means `lastSection` was empty or unrecognized. */
  sectionsReached: number;
  /** Required fields filled, across every section. */
  requiredFilled: number;
  /** The form's fixed total of required fields (currently 23). */
  requiredTotal: number;
  /** requiredFilled / requiredTotal, 0-1. */
  completeness: number;
}

/**
 * How far one applicant got. Pure and lenient — it takes an object and
 * returns an object, validates nothing, and never throws: missing `rawData`
 * reads as no fields filled, and an unrecognized `lastSection` (renamed
 * section, stale client) reads as `sectionsReached: 0` rather than a crash.
 *
 * @param rawData - The stored `rawData` off a `LoanApplication`, or the form's
 *   own in-progress state (same field-key shape).
 * @param lastSection - The section id the applicant most recently had open.
 */
export function computeFormProgress(
  rawData: Record<string, unknown> | null | undefined,
  lastSection: string | null | undefined
): FormProgress {
  const fields = rawData ?? {};
  const sectionIndex = lastSection
    ? APPLICATION_SECTIONS.findIndex((section) => section.id === lastSection)
    : -1;
  const sectionsReached = sectionIndex === -1 ? 0 : sectionIndex + 1;

  let requiredFilled = 0;
  for (const section of APPLICATION_SECTIONS) {
    for (const key of section.requiredFields) {
      if (isFilled(fields[key])) requiredFilled += 1;
    }
  }

  return {
    sectionsReached,
    requiredFilled,
    requiredTotal: TOTAL_REQUIRED_FIELDS,
    completeness: TOTAL_REQUIRED_FIELDS === 0 ? 0 : requiredFilled / TOTAL_REQUIRED_FIELDS
  };
}

/**
 * Whether every required field of one section is filled. Used by the site to
 * decide when to fire the `SolicitudProgress` Meta custom event — a coarser,
 * higher-volume signal than the final `Lead` (see metaPixel.ts).
 */
export function isSectionComplete(
  sectionId: string,
  fields: Record<string, unknown> | null | undefined
): boolean {
  const section = APPLICATION_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return false;
  const values = fields ?? {};
  return section.requiredFields.every((key) => isFilled(values[key]));
}

/**
 * Builds the wire payload for a partial-save POST to the public intake
 * endpoint (`/v1/applications`): the form's current field values plus
 * whichever ad attribution the session captured, tagged as a partial
 * autosave under one `sessionId`.
 *
 * Shared by the site's section-toggle autosave and its pagehide/
 * visibilitychange-hidden beacon, so the two paths always send the same
 * shape — one of them missing a field the other sends would silently break
 * either the draft record or its attribution.
 */
export function buildAutosavePayload(
  form: Record<string, string>,
  attribution: Record<string, string | undefined>,
  sessionId: string,
  lastSection: string
): Record<string, unknown> {
  return {
    ...form,
    ...attribution,
    sessionId,
    partial: true,
    lastSection
  };
}
