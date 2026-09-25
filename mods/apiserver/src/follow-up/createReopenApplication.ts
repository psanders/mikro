/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { DbClient } from "@mikro/common";
import { logger } from "../logger.js";

/**
 * Bring a prospect's abandoned draft back when they write in again. Only an
 * application that was never submitted reopens: ABANDONED with `submittedAt`
 * set means it was withdrawn after review, and that stays closed. Returns
 * whether the application was reopened.
 */
export function createReopenApplication(
  client: DbClient,
  recordProspectActivity: (applicationId: string) => Promise<void>
) {
  return async (applicationId: string): Promise<boolean> => {
    const app = await client.loanApplication.findUnique({ where: { id: applicationId } });
    if (!app || app.status !== "ABANDONED" || app.submittedAt) {
      logger.verbose("reopen skipped — not a never-submitted ABANDONED application", {
        applicationId,
        status: app?.status ?? "NOT_FOUND"
      });
      return false;
    }
    await client.loanApplication.update({ where: { id: app.id }, data: { status: "DRAFT" } });
    await recordProspectActivity(app.id);
    logger.info("abandoned draft reopened on prospect return", { applicationId: app.id });
    return true;
  };
}
