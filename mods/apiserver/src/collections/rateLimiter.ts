/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Simple delay-based rate limiter for WhatsApp messages.
 */

/**
 * Returns a promise that resolves after the given delay (ms).
 * Use between sends to respect WhatsApp rate limits.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
