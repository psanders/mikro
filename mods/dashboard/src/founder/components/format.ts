/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre"
];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function diffInCalendarDays(from: Date, to: Date): number {
  return Math.round((startOfDay(from).getTime() - startOfDay(to).getTime()) / 86_400_000);
}

/**
 * Short, Spanish, relative timestamp for a feed card's meta line, e.g.
 * "hace 5 min", "hace 2 h", "ayer". Falls back to `formatDayLabel` once an
 * event is more than a week old.
 */
export function formatRelativeTime(occurredAt: string, now: Date = new Date()): string {
  const then = new Date(occurredAt);
  const diffSec = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));

  if (diffSec < 60) return "hace instantes";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;

  const diffDays = diffInCalendarDays(now, then);
  if (diffDays === 1) return "ayer";
  if (diffDays > 1 && diffDays < 7) return `hace ${diffDays} d`;

  return formatDayLabel(occurredAt, now).toLowerCase();
}

/**
 * Day-group header label: "Hoy", "Ayer", or "24 de junio".
 */
export function formatDayLabel(occurredAt: string, now: Date = new Date()): string {
  const then = new Date(occurredAt);
  const diffDays = diffInCalendarDays(now, then);
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  return `${then.getDate()} de ${MONTHS_ES[then.getMonth()]}`;
}

/** Clock time "10:24" for a feed row (the day is conveyed by its group header). */
export function formatClockTime(occurredAt: string): string {
  const then = new Date(occurredAt);
  const h = then.getHours();
  const m = then.getMinutes();
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** "RD$ 2,500" — same numeric convention as the rest of the dashboard. */
export function formatAmount(amount: number): string {
  const hasFraction = !Number.isInteger(amount);
  const formatted = new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2
  }).format(amount);
  return `RD$ ${formatted}`;
}

/** "lateFeeAmount" -> "Late fee amount" — fallback label for unmapped payload keys. */
export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Generic display value for an unmapped payload entry. */
export function humanizeValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return new Intl.NumberFormat("es-DO").format(value);
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
