/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { LoanApplication } from "@mikro/common";
import { recordEvent, type EventClient } from "./recordEvent.js";
import { applicationDisplayName, canRecordEvents, resolveActorName } from "./helpers.js";

/**
 * Record `application.evidence_completed`: someone other than the assignee (in
 * practice a collector in the field) saved the last missing piece of evidence.
 * Written intrinsically by the evidence writes, since it depends on the
 * completeness before and after the write.
 */
export async function recordEvidenceCompleted(
  client: EventClient,
  app: LoanApplication,
  actorId: string
): Promise<void> {
  if (!canRecordEvents(client)) return;
  const name = applicationDisplayName(app);
  const actorName = await resolveActorName(client, actorId);
  await recordEvent(client, {
    type: "application.evidence_completed",
    actorId,
    actorName,
    customerName: name,
    applicationId: app.id,
    summary: `Evidencia completa de ${name} · por ${actorName}`,
    payload: {
      applicationId: app.id,
      ...(app.businessName ? { businessName: app.businessName } : {}),
      ...(app.score != null ? { score: app.score } : {})
    }
  });
}
