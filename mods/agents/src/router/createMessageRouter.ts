/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Message router that decides who is writing, which picks the profile (and so
 * the agent) that answers.
 */
import type { ApplicationStatus, Role } from "@mikro/common";
import type { RouteResult, RouterDependencies } from "./types.js";
import { logger } from "../logger.js";
import { validatePhone } from "@mikro/common";

/** Applications in the review pipeline: the APPLICANT agent answers. */
const IN_PIPELINE: ReadonlySet<ApplicationStatus> = new Set([
  "RECEIVED",
  "IN_REVIEW",
  "PENDING_DECISION",
  "APPROVED"
]);

/** A user with several roles routes as the most privileged one. */
const ROLE_PRECEDENCE: readonly Role[] = ["ADMIN", "REVIEWER", "COLLECTOR"];

/**
 * Creates a message router (openspec cx-role-based-agents). Rules, in order:
 * 1. Enabled DB user → their role (ADMIN > REVIEWER > COLLECTOR). Staff come
 *    first: someone who is both staff and a customer is almost always writing
 *    as staff. A disabled user is ignored.
 * 2. Customer → CUSTOMER, carrying a new application of theirs when it is in
 *    the review pipeline (a returning borrower can follow it with the same agent).
 * 3. Latest application DRAFT → prospect (PROSPECT, José).
 * 4. Latest application ABANDONED and never submitted → reopen, then José.
 * 5. Latest application RECEIVED → APPROVED → applicant (APPLICANT).
 * 6. Anyone else → guest (GUEST): no application, REJECTED (flagged, so the
 *    handler hands them to a person), CONVERTED without a customer match, or
 *    withdrawn after submission.
 *
 * Which agent serves each profile is config (agents.yaml); a profile with no
 * agent gets no reply. That decision belongs to the handler, not here.
 */
export function createMessageRouter(deps: RouterDependencies) {
  const { getUserByPhone, getCustomerByPhone } = deps;

  return async function routeMessage(phone: string): Promise<RouteResult> {
    const normalizedPhone = validatePhone(phone);
    logger.verbose("routing message", { phone, normalizedPhone });

    // Independent lookups, in parallel.
    const [customer, user] = await Promise.all([
      getCustomerByPhone({ phone: normalizedPhone }),
      getUserByPhone({ phone: normalizedPhone })
    ]);

    if (user) {
      if (!user.enabled) {
        logger.verbose("user is disabled, ignoring", { phone: normalizedPhone, userId: user.id });
        return { type: "ignored", reason: "user is disabled", phone: normalizedPhone };
      }
      const roles = user.roles.map((r) => r.role);
      const role = ROLE_PRECEDENCE.find((r) => roles.includes(r)) ?? "COLLECTOR";
      logger.verbose("phone belongs to user", {
        phone: normalizedPhone,
        userId: user.id,
        role
      });
      return { type: "user", userId: user.id, name: user.name, role, phone: normalizedPhone };
    }

    const app = deps.findApplicationByPhone
      ? await deps.findApplicationByPhone(normalizedPhone)
      : null;

    if (customer) {
      logger.verbose("phone belongs to customer", {
        phone: normalizedPhone,
        customerId: customer.id
      });
      return {
        type: "customer",
        customerId: customer.id,
        name: customer.name,
        phone: normalizedPhone,
        ...(app && IN_PIPELINE.has(app.status) ? { applicationId: app.applicationId } : {})
      };
    }

    if (app) {
      const ref = {
        applicationId: app.applicationId,
        sessionId: app.sessionId,
        phone: normalizedPhone
      };
      logger.verbose("phone matched a loan application", {
        phone: normalizedPhone,
        applicationId: app.applicationId,
        status: app.status
      });
      if (app.status === "DRAFT") return { type: "prospect", ...ref };
      if (app.status === "ABANDONED" && !app.submittedAt) return { type: "reopen", ...ref };
      if (IN_PIPELINE.has(app.status)) return { type: "applicant", ...ref };
      if (app.status === "REJECTED") {
        return { type: "guest", phone: normalizedPhone, previouslyRejected: true };
      }
    }

    logger.verbose("routing as guest", { phone: normalizedPhone });
    return { type: "guest", phone: normalizedPhone };
  };
}
