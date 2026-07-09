/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Persists the "remind me later" choice on the update banner (issue #162):
 * once the operator postpones a staged version, the banner stays hidden for
 * 24h — even across restarts — so the non-intrusive notification doesn't nag.
 * A newer staged version always breaks through an earlier postpone.
 */
import { readJSON, writeJSON } from "./localStorageJson";

const STORAGE_KEY = "mikro.update.snooze";
const SNOOZE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface SnoozeRecord {
  version: string;
  until: number;
}

function isSnoozeRecord(value: unknown): value is SnoozeRecord {
  const v = value as Partial<SnoozeRecord> | null;
  return typeof v?.version === "string" && typeof v?.until === "number";
}

function read(): SnoozeRecord | null {
  return readJSON(STORAGE_KEY, isSnoozeRecord);
}

/** Postpone the banner for `version` for 24h. */
export function snoozeUpdate(version: string): void {
  writeJSON(STORAGE_KEY, { version, until: Date.now() + SNOOZE_MS } satisfies SnoozeRecord);
}

/** Whether `version`'s banner is currently postponed. */
export function isUpdateSnoozed(version: string): boolean {
  const record = read();
  if (!record || record.version !== version) return false;
  return Date.now() < record.until;
}

/** When `version`'s postpone lapses, or `null` if it isn't currently postponed. */
export function snoozeExpiry(version: string): number | null {
  const record = read();
  if (!record || record.version !== version) return null;
  return record.until;
}
