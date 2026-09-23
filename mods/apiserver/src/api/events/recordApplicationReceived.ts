/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { LoanApplication } from "@mikro/common";
import { amountToNumber } from "@mikro/common";
import { recordEvent, type EventClient } from "./recordEvent.js";
import { applicationDisplayName, canRecordEvents, resolveActorName } from "./helpers.js";

const SOURCE_LABELS: Record<string, string> = {
  FORM: "el sitio web",
  WHATSAPP: "WhatsApp",
  MANUAL: "registro manual"
};

/**
 * Record `application.received` — the event that puts an application in the
 * reviewers' shared queue. Written intrinsically (not at the tRPC boundary) by
 * every path that makes a row RECEIVED: website submit, WhatsApp Flow, promote,
 * and manual creation. `actorId` is the person who did it (promote/manual);
 * applicant-driven intake has no actor and is attributed to "Sistema".
 */
export async function recordApplicationReceived(
  client: EventClient,
  app: LoanApplication,
  actorId?: string
): Promise<void> {
  if (!canRecordEvents(client)) return;
  const name = applicationDisplayName(app);
  const actorName = await resolveActorName(client, actorId);
  const requestedAmount =
    app.requestedAmount != null ? amountToNumber(app.requestedAmount) : undefined;
  await recordEvent(client, {
    type: "application.received",
    ...(actorId ? { actorId } : {}),
    actorName,
    customerName: name,
    applicationId: app.id,
    ...(requestedAmount != null ? { amount: requestedAmount } : {}),
    summary: `Nueva solicitud de ${name} desde ${SOURCE_LABELS[app.source] ?? app.source}`,
    payload: {
      applicationId: app.id,
      ...(app.businessName ? { businessName: app.businessName } : {}),
      ...(app.score != null ? { score: app.score } : {}),
      source: app.source,
      ...(requestedAmount != null ? { requestedAmount } : {})
    }
  });
}

/**
 * Record the system's `application.rejected` for a website submission outside
 * the covered area (no human actor; reason OUT_OF_COVERAGE_AREA).
 */
export async function recordOutOfAreaRejection(
  client: EventClient,
  app: LoanApplication
): Promise<void> {
  if (!canRecordEvents(client)) return;
  const name = applicationDisplayName(app);
  await recordEvent(client, {
    type: "application.rejected",
    actorName: await resolveActorName(client, undefined),
    customerName: name,
    applicationId: app.id,
    summary: `Solicitud de ${name} rechazada automáticamente: fuera de zona`,
    payload: {
      applicationId: app.id,
      ...(app.businessName ? { businessName: app.businessName } : {}),
      ...(app.score != null ? { score: app.score } : {}),
      reason: "OUT_OF_COVERAGE_AREA"
    }
  });
}
