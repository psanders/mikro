/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Persists the "remind me later" choice on the update banner (issue #162):
 * once the operator postpones a staged version, the banner stays hidden for
 * 24h — even across restarts — so the non-intrusive notification doesn't nag.
 * A newer staged version always breaks through an earlier postpone.
 */

const STORAGE_KEY = "mikro.update.snooze";
const SNOOZE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface SnoozeRecord {
  version: string;
  until: number;
}

function read(): SnoozeRecord | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SnoozeRecord>;
    if (typeof parsed.version !== "string" || typeof parsed.until !== "number") return null;
    return { version: parsed.version, until: parsed.until };
  } catch {
    return null;
  }
}

/** Postpone the banner for `version` for 24h. */
export function snoozeUpdate(version: string): void {
  try {
    const record: SnoozeRecord = { version, until: Date.now() + SNOOZE_MS };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Best-effort — a private-browsing quota error just means the banner
    // re-shows sooner than 24h, which is harmless.
  }
}

/** Whether `version`'s banner is currently postponed. */
export function isUpdateSnoozed(version: string): boolean {
  const record = read();
  if (!record || record.version !== version) return false;
  return Date.now() < record.until;
}
