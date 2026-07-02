/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Mobile port of the Ops dashboard's Dominican identity/contact formatters
 * (`mods/dashboard/src/lib/inputFormat.ts`). Kept in sync so reviewer edits
 * from mobile send the same display strings the backend normalizes leniently.
 * Formatters are pure and idempotent — safe to run on every keystroke.
 */

/** Keep only ASCII digits. */
function digits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Dominican cédula mask: `XXX-XXXXXXX-X` (11 digits). Caps at 11 digits and
 * groups 3-7-1.
 */
export function formatCedula(value: string): string {
  const d = digits(value).slice(0, 11);
  const parts: string[] = [d.slice(0, 3)];
  if (d.length > 3) parts.push(d.slice(3, 10));
  if (d.length > 10) parts.push(d.slice(10, 11));
  return parts.filter(Boolean).join("-");
}

/** A complete cédula has all 11 digits. */
export function isCedulaComplete(value: string): boolean {
  return digits(value).length === 11;
}

/**
 * Dominican phone mask: `(XXX) XXX-XXXX` (10 digits). Drops a leading country
 * code `1` if present, then caps at 10 digits.
 */
export function formatPhone(value: string): string {
  let d = digits(value);
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length <= 3) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** A complete phone has all 10 digits. */
export function isPhoneComplete(value: string): boolean {
  let d = digits(value);
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10;
}

export type FieldFormat = "cedula" | "phone";

/** Apply the mask for a given format. */
export function applyFormat(format: FieldFormat, value: string): string {
  return format === "cedula" ? formatCedula(value) : formatPhone(value);
}

/**
 * Validate a formatted value for a field format. Empty is allowed (fields are
 * optional / partial); a non-empty value must be complete. Returns an error
 * message or null.
 */
export function formatError(format: FieldFormat, value: string): string | null {
  if (!value.trim()) return null;
  if (format === "cedula" && !isCedulaComplete(value)) return "Cédula incompleta (11 dígitos).";
  if (format === "phone" && !isPhoneComplete(value)) return "Teléfono incompleto (10 dígitos).";
  return null;
}
