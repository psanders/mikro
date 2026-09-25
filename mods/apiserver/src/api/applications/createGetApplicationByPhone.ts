/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ApplicationStatus, DbClient } from "@mikro/common";

/** The latest application for a phone, as the WhatsApp router needs it. */
export interface ApplicationByPhone {
  applicationId: string;
  sessionId: string;
  status: ApplicationStatus;
  /** Set on the first complete submission and never cleared. */
  submittedAt: Date | null;
  /** Still a DRAFT. Kept for callers that only care about intake. */
  partial: boolean;
}

/**
 * Look up the most recent loan application for a phone. The message router
 * turns its status into a profile: DRAFT → PROSPECT, the review pipeline →
 * APPLICANT, a never-submitted ABANDONED → reopen (openspec cx-role-based-agents).
 */
export function createGetApplicationByPhone(client: DbClient) {
  return async (phone: string): Promise<ApplicationByPhone | null> => {
    const app = await client.loanApplication.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" }
    });
    if (!app) return null;
    return {
      applicationId: app.id,
      sessionId: app.sessionId,
      status: app.status,
      submittedAt: app.submittedAt ?? null,
      partial: app.status === "DRAFT"
    };
  };
}
