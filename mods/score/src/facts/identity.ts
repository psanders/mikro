/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Does a bureau's identity match the application? Names are compared loosely
 * (accents, case and order ignored; at least one given name and one surname
 * must appear), because bureaus and lenders spell names inconsistently.
 */
const tokens = (s: string | null | undefined): string[] =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter((t) => t.length > 1);

export function nameMatches(
  applicant: { firstName?: string | null; lastName?: string | null },
  bureauFullName: string
): boolean {
  const bureau = new Set(tokens(bureauFullName));
  const first = tokens(applicant.firstName);
  const last = tokens(applicant.lastName);
  if (!first.length || !last.length || !bureau.size) return true; // nothing to compare
  return first.some((t) => bureau.has(t)) && last.some((t) => bureau.has(t));
}

export function birthDateMatches(
  applicantIso: string | null | undefined,
  bureauIso: string
): boolean {
  if (!applicantIso) return true; // nothing to compare
  return applicantIso.slice(0, 10) === bureauIso.slice(0, 10);
}
