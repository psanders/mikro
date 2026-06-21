/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { DbClient } from "@mikro/common";
import { logger } from "../logger.js";

export function createCancelApplicationJobs(client: DbClient) {
  return async (applicationId: string): Promise<void> => {
    const { count } = await client.followUpJob.updateMany({
      where: { applicationId, status: "PENDING" },
      data: { status: "CANCELLED" }
    });
    if (count > 0) {
      logger.verbose("follow-up jobs cancelled", { applicationId, count });
    }
  };
}
