/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

/** Join class names, dropping falsy values. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
