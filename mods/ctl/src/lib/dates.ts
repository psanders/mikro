/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Date-only (YYYY-MM-DD) helpers that operate in the local timezone.
 *
 * `new Date().toISOString().slice(0, 10)` and `new Date("YYYY-MM-DD")` both
 * work in UTC, which silently shifts by a day in any negative-UTC-offset
 * timezone (e.g. late evening local time is already "tomorrow" in UTC).
 * These helpers stay in local time end-to-end so "today" means today and an
 * `--end-date` boundary covers the whole local day.
 */

/** Today's date (or an arbitrary Date's date) as YYYY-MM-DD in local time. */
export function localDateString(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Parse a YYYY-MM-DD string as local midnight (start of that day). */
export function parseDateOnly(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) {
    throw new Error(`Invalid date: ${dateStr}. Use YYYY-MM-DD.`);
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
}

/** Parse a YYYY-MM-DD string as local end-of-day (inclusive upper bound). */
export function endOfDayLocal(dateStr: string): Date {
  const d = parseDateOnly(dateStr);
  d.setHours(23, 59, 59, 999);
  return d;
}
