/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared "safe JSON in localStorage" primitives: read validates shape and
 * returns `null` on any parse/shape failure (private browsing, corrupted
 * value, schema drift) instead of throwing; write is best-effort and
 * swallows quota errors. Callers own their own defaulting/merging.
 */

/** Reads `key`, parses it as JSON, and returns it only if `isValid` accepts it. */
export function readJSON<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Best-effort write — a private-browsing quota error is silently ignored. */
export function writeJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort — the caller's feature just won't persist this write.
  }
}
