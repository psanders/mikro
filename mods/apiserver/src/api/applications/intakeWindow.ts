/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * "Intake open" (openspec jose-keep-gathering): José keeps a submitted
 * (RECEIVED) application and asks its remaining form fields while the
 * conversation is live. He only answers — never messages first — so the window
 * follows WhatsApp's 24h customer-service window. Once the person has been
 * quiet for longer, or a reviewer takes the application, the applicant agent
 * (Sofía) answers again.
 */
import type { PrismaClient } from "../../generated/prisma/client.js";
import { missingApplicationFields, type ApplicationFieldsRow } from "../jose/missingFields.js";

/** How long after José's last reply he still owns a submitted application. */
export const INTAKE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface IntakeWindowApplication extends ApplicationFieldsRow {
  id: string;
  status: string;
  submittedAt: Date | null;
  intakeClosedAt: Date | null;
}

/**
 * Whether José still serves this application. All of:
 * - it is RECEIVED (a reviewer hasn't taken it) and José hasn't closed intake;
 * - at least one form field is missing;
 * - José replied on it within the last 24h, or — a first message after a
 *   web-form submission — no one has talked with them since it was submitted.
 *   Someone already talking with the applicant agent is not switched to José.
 */
export function createIsIntakeOpen(
  db: Pick<PrismaClient, "conversationTurn">,
  now: () => Date = () => new Date()
) {
  return async (app: IntakeWindowApplication): Promise<boolean> => {
    if (app.status !== "RECEIVED" || app.intakeClosedAt) return false;
    if (missingApplicationFields(app).length === 0) return false;

    const lastJose = await db.conversationTurn.findFirst({
      where: { applicationId: app.id, role: "AGENT", profile: "PROSPECT" },
      orderBy: { id: "desc" },
      select: { createdAt: true }
    });
    if (lastJose) return now().getTime() - lastJose.createdAt.getTime() < INTAKE_WINDOW_MS;

    const applicantTurn = await db.conversationTurn.findFirst({
      where: {
        applicationId: app.id,
        profile: "APPLICANT",
        ...(app.submittedAt ? { createdAt: { gte: app.submittedAt } } : {})
      },
      select: { id: true }
    });
    return !applicantTurn;
  };
}
