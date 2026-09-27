/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ApplicationStatus, DbClient } from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { IntakeWindowApplication } from "./intakeWindow.js";

export interface ApplicationLookupDeps {
  /** Whether José still serves a submitted application (see intakeWindow.ts). */
  isIntakeOpen?: (app: IntakeWindowApplication) => Promise<boolean>;
}

/** The latest application for a phone, as the WhatsApp router needs it. */
export interface ApplicationByPhone {
  applicationId: string;
  sessionId: string;
  status: ApplicationStatus;
  /** Set on the first complete submission and never cleared. */
  submittedAt: Date | null;
  /** When it was approved or rejected (a REJECTED application's cooldown starts here). */
  decidedAt: Date | null;
  /** Still a DRAFT. Kept for callers that only care about intake. */
  partial: boolean;
  /** RECEIVED and José still asks its remaining fields (openspec jose-keep-gathering). */
  intakeOpen: boolean;
}

async function toLookup(
  app: IntakeWindowApplication & { sessionId: string; decidedAt: Date | null },
  deps: ApplicationLookupDeps
): Promise<ApplicationByPhone> {
  return {
    applicationId: app.id,
    sessionId: app.sessionId,
    status: app.status as ApplicationStatus,
    submittedAt: app.submittedAt ?? null,
    decidedAt: app.decidedAt ?? null,
    partial: app.status === "DRAFT",
    intakeOpen:
      app.status === "RECEIVED" && deps.isIntakeOpen ? await deps.isIntakeOpen(app) : false
  };
}

/**
 * Look up the most recent loan application for a phone. The message router
 * turns its status into a profile: DRAFT → PROSPECT, the review pipeline →
 * APPLICANT, a never-submitted ABANDONED → reopen (openspec cx-role-based-agents).
 */
export function createGetApplicationByPhone(client: DbClient, deps: ApplicationLookupDeps = {}) {
  return async (phone: string): Promise<ApplicationByPhone | null> => {
    const app = await client.loanApplication.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" }
    });
    if (!app) return null;
    return toLookup(
      { ...app, intakeClosedAt: app.intakeClosedAt ?? null, decidedAt: app.decidedAt ?? null },
      deps
    );
  };
}

/**
 * The same lookup for a WhatsApp username sender, who reaches us with only a
 * business-scoped user id (BSUID) linked to their application.
 */
export function createGetApplicationByWhatsAppUserId(
  db: Pick<PrismaClient, "loanApplication">,
  deps: ApplicationLookupDeps = {}
) {
  return async (bsuid: string): Promise<ApplicationByPhone | null> => {
    const app = await db.loanApplication.findFirst({
      where: { whatsappUserId: bsuid },
      orderBy: { createdAt: "desc" }
    });
    if (!app) return null;
    return toLookup(app as unknown as Parameters<typeof toLookup>[0], deps);
  };
}
