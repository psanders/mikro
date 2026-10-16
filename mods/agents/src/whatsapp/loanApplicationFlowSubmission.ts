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
 * What the apiserver did with a Flow submission (issue #302: one application
 * per person). `cooldown`: rejected less than 30 days ago, nothing created
 * until `reapplyFrom`; `in_process`: they already have one being handled.
 */
export type FlowSubmitOutcome =
  | { outcome: "received" | "in_process" | "invalid" }
  | { outcome: "cooldown"; reapplyFrom: Date; outOfArea?: boolean };

/** "22 de octubre de 2026", in the Dominican Republic's time zone. */
export function reapplyDateText(reapplyFrom: Date): string {
  return new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Santo_Domingo"
  }).format(reapplyFrom);
}

export const INTAKE_IN_PROCESS_MESSAGE =
  "Ya tienes una solicitud en proceso, así que no creamos otra. " +
  "Si tienes preguntas sobre ella, escríbenos por aquí.";

/** The WhatsApp reply for a Flow submission's outcome. */
export function flowReplyFor(result: FlowSubmitOutcome | void): string {
  if (result?.outcome === "cooldown") {
    const date = reapplyDateText(result.reapplyFrom);
    return result.outOfArea
      ? `Tu solicitud anterior se cerró porque por el momento solo atendemos negocios en ` +
          `Puerto Plata. Puedes volver a solicitar a partir del ${date}.`
      : `Tu solicitud anterior no fue aprobada. Puedes volver a solicitar a partir del ${date}.`;
  }
  if (result?.outcome === "in_process") return INTAKE_IN_PROCESS_MESSAGE;
  return INTAKE_RECEIVED_MESSAGE;
}

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
  phone: string | undefined,
  sessionId: string
): Record<string, string | boolean> {
  const payload: Record<string, string | boolean> = {
    sessionId,
    partial: false,
    // The applicant's own phone is the WhatsApp sender — not asked in the form.
    // A WhatsApp username sender may reach us without one: then it's omitted
    // and the submission is tied to them by their BSUID instead.
    ...(phone ? { phone } : {})
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
