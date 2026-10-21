/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Find past loan applications by name, phone or cédula for the unified search
 * (openspec add-loan-renewal). SQLite's LIKE only folds ASCII case and sees
 * punctuation, so "juan perez" would miss "Juan Pérez" and "809-555-0142" would
 * miss "8095550142". The candidates (DRAFT and ABANDONED excluded) are therefore
 * narrowed in code with accents folded and phone/cédula compared as digits.
 * Scale note: this reads at most `CANDIDATE_CAP` newest rows per search; at the
 * current volume that is the whole table, and the debounced search is cheap.
 */
import { SEARCHABLE_APPLICATION_STATUSES } from "@mikro/common";
import type { EventClient } from "./recordEvent.js";

const CANDIDATE_CAP = 5000;

export interface ApplicationSearchHit {
  id: string;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  phone: string | null;
  idNumber: string | null;
  status: string;
  customerId: string | null;
  createdAt: Date;
}

/** Lowercase, accent-free, trimmed — so "Pérez" and "perez" compare equal. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

const digitsOf = (s: string | null | undefined): string => (s ?? "").replace(/\D/g, "");

/** A query made only of digits and phone/cédula punctuation. */
const LOOKS_NUMERIC = /^[\d\s\-+().]+$/;

/**
 * Whether an application matches a free-text query.
 *
 * - Numeric query (3+ digits): phone or cédula, compared as digits only, so
 *   `031-0567812-4`, `03105678124` and `567812` all find the same cédula, and
 *   `809 555 0142` finds `+1 (809) 555-0142`.
 * - Otherwise: every typed word must appear in the first name, last name or
 *   business name (accents and case ignored), so a full or partial name works
 *   in any order.
 */
export function matchesApplication(
  row: Pick<ApplicationSearchHit, "firstName" | "lastName" | "businessName" | "phone" | "idNumber">,
  query: string
): boolean {
  const q = query.trim();
  if (!q) return false;
  if (LOOKS_NUMERIC.test(q)) {
    const digits = digitsOf(q);
    if (digits.length < 3) return false;
    return digitsOf(row.phone).includes(digits) || digitsOf(row.idNumber).includes(digits);
  }
  const hay = fold([row.firstName, row.lastName, row.businessName].filter(Boolean).join(" "));
  return fold(q)
    .split(/\s+/)
    .every((word) => hay.includes(word));
}

/** Newest-first applications worth finding that match `query`, capped at `limit`. */
export async function searchApplications(
  client: EventClient,
  query: string,
  limit: number
): Promise<ApplicationSearchHit[]> {
  const rows = await client.loanApplication.findMany({
    where: { status: { in: [...SEARCHABLE_APPLICATION_STATUSES] } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      businessName: true,
      phone: true,
      idNumber: true,
      status: true,
      customerId: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" },
    take: CANDIDATE_CAP
  });
  return rows.filter((r) => matchesApplication(r, query)).slice(0, limit);
}
