/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Which form fields an application still lacks, highest-signal first (the
 * order José asks in). Shared by getApplicationState and the "intake open"
 * check that keeps José on a submitted application while fields are missing.
 */
import { APPLICATION_CONTENT_KEYS, hasPartner, sortByFieldPriority } from "@mikro/common";

/** The application columns José's form fields live in (plus `rawData`). */
export interface ApplicationFieldsRow {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  idNumber: string | null;
  dateOfBirth?: Date | string | null;
  maritalStatus: string | null;
  businessType: string | null;
  businessName: string | null;
  requestedAmount: unknown;
  purpose: string | null;
  requestedTermWeeks: unknown;
  province: string | null;
  homeAddress: string | null;
  rawData: unknown;
}

/** Stable columns + rawData as one flat map of form fields. */
export function applicationFields(app: ApplicationFieldsRow): Record<string, unknown> {
  const rawData = (app.rawData as Record<string, unknown>) ?? {};
  return {
    firstName: app.firstName,
    lastName: app.lastName,
    phone: app.phone,
    idNumber: app.idNumber,
    dateOfBirth: app.dateOfBirth ? String(app.dateOfBirth) : null,
    businessType: app.businessType,
    businessName: app.businessName,
    requestedAmount: app.requestedAmount,
    purpose: app.purpose,
    requestedTermWeeks: app.requestedTermWeeks,
    province: app.province,
    homeAddress: app.homeAddress,
    ...rawData,
    // The column holds the normalized code; rawData may hold the form label.
    maritalStatus: app.maritalStatus ?? rawData.maritalStatus ?? null
  };
}

const isEmpty = (value: unknown) => value === null || value === undefined || value === "";

/** Spouse fields only apply to someone married or in a common-law union. */
const SPOUSE_KEYS = new Set<string>(["spouseName", "spousePhone"]);

/**
 * Missing form fields in a flat field map, ordered by knockout + scoring
 * weight. A single, divorced or widowed applicant is never asked about a
 * spouse (nor is someone whose marital status is still unknown: that question
 * comes first).
 */
export function missingFieldsOf(fields: Record<string, unknown>): string[] {
  const partnered = hasPartner(fields.maritalStatus);
  return sortByFieldPriority(
    APPLICATION_CONTENT_KEYS.filter(
      (key) => isEmpty(fields[key]) && (partnered || !SPOUSE_KEYS.has(key))
    )
  );
}

/** Missing form fields, ordered by knockout + scoring weight. */
export function missingApplicationFields(app: ApplicationFieldsRow): string[] {
  return missingFieldsOf(applicationFields(app));
}
