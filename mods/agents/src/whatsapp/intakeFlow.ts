/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Prospect loan-application intake over WhatsApp via a native Flow form. An
 * unknown number that messages the business line is greeted with a button that
 * opens the published Flow (the in-chat equivalent of the website's solicitud
 * form). On submit, the answers arrive as an `nfm_reply` and are mapped to the
 * same intake payload the website posts, so scoring and the dashboard are
 * identical regardless of channel.
 */
import type { SendWhatsAppMessageInput } from "@mikro/common";

/** First (and only) screen id in solicitud-credito.json. */
export const INTAKE_FLOW_SCREEN = "SOLICITUD";

const INTAKE_FLOW_CTA = "Solicitar crédito";
const INTAKE_FLOW_HEADER = "Mikro Crédito";
const INTAKE_FLOW_BODY =
  "¡Hola! Para evaluar tu solicitud de crédito, toca el botón y completa el formulario. " +
  "Toma menos de 5 minutos y tu información viaja cifrada.";
const INTAKE_FLOW_FOOTER = "Respuesta en menos de 24 horas";

/** Confirmation sent after a successful Flow submission (mirrors the website success screen). */
export const INTAKE_RECEIVED_MESSAGE =
  "¡Solicitud recibida! La revisaremos y te responderemos en menos de 24 horas. " +
  "Si tienes preguntas, escríbenos por aquí.";

/**
 * Build the interactive Flow message that opens the intake form.
 * `flowToken` is opaque and echoed back in the nfm_reply; we derive it from the
 * phone so logs correlate, though the submitter's phone also comes from `from`.
 */
export function buildIntakeFlowMessage(
  phone: string,
  flowId: string,
  draft = false
): SendWhatsAppMessageInput {
  return {
    phone,
    flow: {
      flowId,
      flowToken: `intake-${phone}-${Date.now()}`,
      screen: INTAKE_FLOW_SCREEN,
      cta: INTAKE_FLOW_CTA,
      header: INTAKE_FLOW_HEADER,
      body: INTAKE_FLOW_BODY,
      footer: INTAKE_FLOW_FOOTER,
      ...(draft && { mode: "draft" as const })
    }
  };
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
