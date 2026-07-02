/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { getRoles, getNavMode, hasEvaluatorRole, isDualRole } from "./auth";

export const EVALUATOR_HOME = "/(evaluator)";
export const COLLECTOR_HOME = "/(tabs)";

/**
 * Resolves which tab group a logged-in, unlocked user should land on, based
 * on their decoded roles (cached alongside the token, see lib/auth.ts):
 * - COLLECTOR-only -> collector tabs (unchanged).
 * - REVIEWER-only -> evaluator tabs.
 * - Dual-role (per `isDualRole`: COLLECTOR + evaluator role, OR plain ADMIN,
 *   who has server-side access to both surfaces) -> evaluator tabs by
 *   default, unless the user manually switched to collector via the Perfil
 *   switcher (persisted nav mode preference).
 */
export async function resolveHomeRoute(): Promise<string> {
  const roles = await getRoles();
  if (!hasEvaluatorRole(roles)) return COLLECTOR_HOME;

  if (isDualRole(roles)) {
    const mode = await getNavMode();
    return mode === "collector" ? COLLECTOR_HOME : EVALUATOR_HOME;
  }

  return EVALUATOR_HOME;
}
