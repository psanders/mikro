/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Ingestion of loan-application Flow submissions over WhatsApp. The outbound
 * promo template's CTA opens the published Flow; on submit, the answers arrive
 * as an `nfm_reply` and are mapped to the same intake payload the website posts,
 * so scoring and the dashboard are identical regardless of channel.
 */

/** Confirmation sent after a successful Flow submission (mirrors the website success screen). */
export const INTAKE_RECEIVED_MESSAGE =
  "¡Solicitud recibida! La revisaremos y te responderemos en menos de 24 horas. " +
  "Si tienes preguntas, escríbenos por aquí.";

/**
 * Convert a Flow DatePicker value (Unix epoch milliseconds as a string) to the
 * ISO `YYYY-MM-DD` the intake normalizer expects. Pass through values that are
 * already date-like.
 */
function normalizeFlowDate(value: string): string {
  if (/^\d{10,}$/.test(value)) {
    const d = new Date(Number(value));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return value;
}

/** Content keys carried as dates (need epoch→ISO conversion). */
const DATE_KEYS = new Set(["dateOfBirth"]);

/**
 * Map parsed Flow answers to the website intake payload: stringify every value,
 * convert dates, inject the WhatsApp number as `phone`, and stamp a
 * redelivery-safe `sessionId` so a re-sent webhook upserts the same row.
 */
export function mapFlowAnswersToPayload(
  answers: Record<string, unknown>,
  phone: string,
  sessionId: string
): Record<string, string | boolean> {
  const payload: Record<string, string | boolean> = {
    sessionId,
    partial: false,
    // The applicant's own phone is the WhatsApp sender — not asked in the form.
    phone
  };

  for (const [key, raw] of Object.entries(answers)) {
    if (raw == null) continue;
    if (key === "phone" || key === "sessionId" || key === "partial") continue;
    let value = String(raw).trim();
    if (!value) continue;
    if (DATE_KEYS.has(key)) value = normalizeFlowDate(value);
    payload[key] = value;
  }

  return payload;
}
