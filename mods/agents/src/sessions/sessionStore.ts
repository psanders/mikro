/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { getSessionTimeoutSeconds } from "../config.js";
import { logger } from "../logger.js";

const sessions = new Map<string, { lastMessageAt: Date }>();

/**
 * Check if the given identifier (phone or userId) is starting a new session.
 * A new session means no previous interaction, or the last message was older than the session timeout.
 *
 * @param identifier - Phone number (guest) or userId (user)
 * @returns true if this is a new session (should show full greeting when user greets)
 */
export function isNewSession(identifier: string): boolean {
  const session = sessions.get(identifier);
  if (!session) {
    logger.verbose("session not found, treating as new session", { identifier });
    return true;
  }

  const timeoutMs = getSessionTimeoutSeconds() * 1000;
  const elapsed = Date.now() - session.lastMessageAt.getTime();
  const expired = elapsed > timeoutMs;
  logger.verbose("session check", {
    identifier,
    elapsedMs: elapsed,
    timeoutMs,
    isNewSession: expired
  });
  return expired;
}

/**
 * Update the last message timestamp for the given identifier.
 * Call this after processing a message so the next message within the timeout window is treated as same session.
 *
 * @param identifier - Phone number (guest) or userId (user)
 */
export function touchSession(identifier: string): void {
  sessions.set(identifier, { lastMessageAt: new Date() });
  logger.verbose("session touched", { identifier });
}
