/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

/**
 * A WhatsApp business-scoped user ID (BSUID), e.g. "DO.1610031533916997":
 * ISO country code, a dot, then an opaque id. Meta sends it instead of a phone
 * for a user who hides their number behind a WhatsApp username, and it is
 * stable for that user with our business.
 */
const BSUID_RE = /^[A-Z]{2}\.[A-Za-z0-9]+$/;

/** Whether a WhatsApp address is a BSUID rather than a phone number. */
export function isBusinessScopedUserId(address: string): boolean {
  return BSUID_RE.test(address);
}
