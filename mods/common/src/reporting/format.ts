/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared money/percent/date formatting helpers for the reporting foundation's
 * report definitions. Mirrors the loan-statement report's local helpers
 * (kept private there) so every migrated report renders DOP amounts and
 * dates identically without re-deriving the same three formatters five times.
 */
import { formatMoney } from "../utils/formatMoney.js";

export function formatDop(n: number): string {
  return `RD$${formatMoney(n)}`;
}

export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

/**
 * Date-only business values are stored at UTC midnight; format on the UTC
 * calendar day so a negative-offset runtime timezone doesn't shift them a
 * day earlier (see loan-statement's `formatDateEs` — same fix, same reason).
 */
export function formatDateEs(d: string | Date): string {
  return new Date(d).toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}
