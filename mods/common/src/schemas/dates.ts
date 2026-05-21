/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Safe date-input schemas for tRPC inputs.
 *
 * `z.coerce.date()` silently turns `null` into `new Date(null)` — the Unix
 * epoch (1970-01-01). Because `.optional()` only short-circuits `undefined`,
 * a `null` (e.g. produced by `JSON.stringify` on an `Invalid Date`) sneaks
 * through and gets persisted as 1970-01-01, which then makes mora /
 * days-late calculations explode (see the loan #10035 incident).
 *
 * These helpers pre-clean the input before validation:
 *   - `null` and empty strings collapse to `undefined` so they cannot
 *     reach the epoch-coercing branch of `z.coerce.date()`.
 *   - Anything else is forwarded to `z.coerce.date()` unchanged, so
 *     unparseable strings / Invalid Date instances still fail loudly
 *     with a regular ValidationError.
 *   - A floor of `MIN_ACCEPTED_DATE_MS` rejects accidental epoch /
 *     pre-2020 dates regardless of how they arrived.
 */
import { z } from "zod/v4";

/**
 * Earliest plausible date for any business record in this codebase.
 * Anything older almost certainly indicates a `new Date(null)` /
 * `new Date(0)` / bad-input coercion bug rather than a legitimate value.
 */
export const MIN_ACCEPTED_DATE_MS = Date.UTC(2020, 0, 1);

function dropNullishAndEmpty(v: unknown): unknown {
  if (v === null) return undefined;
  if (typeof v === "string" && v.trim() === "") return undefined;
  return v;
}

/**
 * Optional date input. Accepts `Date`, ISO string, or numeric timestamp.
 * - `undefined`, `null`, and empty strings collapse to `undefined`
 *   (so a bad-but-nullish value never becomes 1970-01-01).
 * - Unparseable strings and Invalid Date instances fail validation
 *   loudly, the same as the previous `z.coerce.date()` behaviour.
 * - Dates earlier than {@link MIN_ACCEPTED_DATE_MS} are rejected.
 *
 * The outer `.optional()` is what makes object keys using this schema
 * truly optional at the TypeScript input level (otherwise `z.preprocess`
 * makes the key input type `unknown` and required).
 */
export const safeOptionalDate = z
  .preprocess(dropNullishAndEmpty, z.coerce.date().optional())
  .refine(
    (d) => d === undefined || d.getTime() >= MIN_ACCEPTED_DATE_MS,
    "Date must be on or after 2020-01-01"
  )
  .optional();

/**
 * Required date input. Same parsing rules as {@link safeOptionalDate},
 * but `undefined` / `null` / empty fail validation instead of being
 * accepted, and the {@link MIN_ACCEPTED_DATE_MS} floor is always enforced.
 */
export const safeRequiredDate = z
  .preprocess(dropNullishAndEmpty, z.coerce.date())
  .refine((d) => d.getTime() >= MIN_ACCEPTED_DATE_MS, "Date must be on or after 2020-01-01");
