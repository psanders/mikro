/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { canManagePayments, getRoles } from "./auth";

export const COLLECTOR_HOME = "/(tabs)";
/** Shown to REVIEWER-only accounts: application review lives in the Ops app (desktop). */
export const USE_OPS_ROUTE = "/usa-ops";

/**
 * Where a logged-in, unlocked user lands. The mobile app is the collector app:
 * COLLECTOR and ADMIN go to the collector tabs. Application review moved to
 * the Ops desktop app (openspec add-application-review-flow), so a
 * REVIEWER-only account gets a screen that points there instead.
 */
export async function resolveHomeRoute(): Promise<string> {
  const roles = await getRoles();
  if (roles.length > 0 && !canManagePayments(roles)) return USE_OPS_ROUTE;
  return COLLECTOR_HOME;
}
