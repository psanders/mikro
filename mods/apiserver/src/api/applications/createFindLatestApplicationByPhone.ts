/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { DbClient } from "@mikro/common";

/**
 * Look up the most recently created loan application for a canonical E.164 phone.
 * Used for WhatsApp-only phone correlation: a completed intake Flow folds into an
 * existing application for the same number (e.g. one a reviewer just created)
 * instead of spawning a duplicate row. Returns the matching `sessionId`, or null.
 *
 * @param client - The database client
 */
export function createFindLatestApplicationByPhone(client: DbClient) {
  return async (phone: string): Promise<{ sessionId: string } | null> => {
    const app = await client.loanApplication.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" }
    });
    return app ? { sessionId: app.sessionId } : null;
  };
}
