/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Marital status is accepted as a code only (MARITAL_STATUSES). Anything else —
 * typically a cached site tab or an old desktop build still posting the old
 * "Soltero(a)" label — must never fail a submission: the value is dropped and
 * logged so the stale client shows up in the logs.
 */
import { isMaritalStatus } from "@mikro/common";
import { logger } from "../../logger.js";

/** True (and a warning logged) when the payload carries a non-code marital status. */
export function droppedMaritalStatus(
  payload: Record<string, unknown>,
  where: string,
  ids: Record<string, unknown> = {}
): boolean {
  const value = payload.maritalStatus;
  if (typeof value !== "string" || !value.trim() || isMaritalStatus(value)) return false;
  logger.warn("unrecognized maritalStatus dropped", { where, value, ...ids });
  return true;
}
