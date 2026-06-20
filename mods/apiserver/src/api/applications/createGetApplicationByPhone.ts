/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { DbClient } from "@mikro/common";

/**
 * Look up the most recent loan application for a phone. Returns sessionId and
 * whether the application is still partial (DRAFT status). Used by the message
 * router to identify and route prospect WhatsApp messages to José.
 */
export function createGetApplicationByPhone(client: DbClient) {
  return async (phone: string): Promise<{ sessionId: string; partial: boolean } | null> => {
    const app = await client.loanApplication.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" }
    });
    if (!app) return null;
    return { sessionId: app.sessionId, partial: app.status === "DRAFT" };
  };
}
