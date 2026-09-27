/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Which form fields an application still lacks, highest-signal first (the
 * order José asks in). Shared by getApplicationState and the "intake open"
 * check that keeps José on a submitted application while fields are missing.
 */
import { APPLICATION_CONTENT_KEYS, sortByFieldPriority } from "@mikro/common";

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
}

const isEmpty = (value: unknown) => value === null || value === undefined || value === "";

/** Missing form fields, ordered by knockout + scoring weight. */
export function missingApplicationFields(app: ApplicationFieldsRow): string[] {
  const fields = applicationFields(app);
  return sortByFieldPriority(APPLICATION_CONTENT_KEYS.filter((key) => isEmpty(fields[key])));
}
