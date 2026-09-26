/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Message router that decides who is writing, which picks the profile (and so
 * the agent) that answers.
 */
import type { ApplicationStatus, Role } from "@mikro/common";
import type {
  ApplicationLookupResult,
  CustomerLookupResult,
  RouteResult,
  RouterDependencies,
  SenderIdentity
} from "./types.js";
import { logger } from "../logger.js";
import { validatePhone } from "@mikro/common";

/** Applications in the review pipeline: the APPLICANT agent answers. */
const IN_PIPELINE: ReadonlySet<ApplicationStatus> = new Set([
  "RECEIVED",
  "IN_REVIEW",
  "PENDING_DECISION",
  "APPROVED"
]);

/**
 * How long after a rejection someone may apply again (founder decision
 * 2026-09-26). Before that the guest agent tells them the date; after it they
 * are a regular guest.
 */
export const REAPPLY_COOLDOWN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

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
 * A sender with no phone (WhatsApp username; Meta sent only a BSUID) is
 * matched by the BSUID stored on customers and applications, then follows
 * rules 2–6; with no match they are an `unmatchedUsername` guest.
 *
 * 6. Anyone else → guest (GUEST): no application, REJECTED (within
 *    REAPPLY_COOLDOWN_DAYS of the decision it carries `reapplyFrom`, so the
 *    guest agent tells them when they may apply again), CONVERTED without a
 *    customer match, or withdrawn after submission.
 *
 * Which agent serves each profile is config (agents.yaml); a profile with no
 * agent gets no reply. That decision belongs to the handler, not here.
 */
export function createMessageRouter(deps: RouterDependencies) {
  const { getUserByPhone, getCustomerByPhone } = deps;

  /**
   * Customer / application rules, shared by phone and username senders.
   * `address` is what goes back in the route's `phone` field.
   */
  function routeByRecords(
    address: string,
    customer: CustomerLookupResult | null,
    app: ApplicationLookupResult | null
  ): RouteResult {
    if (customer) {
      logger.verbose("sender is a customer", { address, customerId: customer.id });
      return {
        type: "customer",
        customerId: customer.id,
        name: customer.name,
        phone: address,
        ...(app && IN_PIPELINE.has(app.status) ? { applicationId: app.applicationId } : {})
      };
    }

    if (app) {
      const ref = { applicationId: app.applicationId, sessionId: app.sessionId, phone: address };
      logger.verbose("sender matched a loan application", {
        address,
        applicationId: app.applicationId,
        status: app.status
      });
      if (app.status === "DRAFT") return { type: "prospect", ...ref };
      if (app.status === "ABANDONED" && !app.submittedAt) return { type: "reopen", ...ref };
      if (IN_PIPELINE.has(app.status)) return { type: "applicant", ...ref };
      if (app.status === "REJECTED") {
        const rejectedAt = app.decidedAt ?? app.submittedAt;
        const reapplyFrom = rejectedAt
          ? new Date(rejectedAt.getTime() + REAPPLY_COOLDOWN_DAYS * DAY_MS)
          : null;
        if (reapplyFrom && reapplyFrom.getTime() > Date.now()) {
          return { type: "guest", phone: address, previouslyRejected: true, reapplyFrom };
        }
      }
    }

    logger.verbose("routing as guest", { address });
    return { type: "guest", phone: address };
  }

  /**
   * A WhatsApp username sender: Meta gave only their business-scoped user id.
   * Match it against the ids stored on customers and applications; staff are
   * not matched (their numbers are normally visible to us).
   */
  async function routeUsernameSender(identity: SenderIdentity): Promise<RouteResult> {
    const bsuid = identity.bsuid ?? identity.address;
    const [customer, app] = await Promise.all([
      deps.findCustomerByWhatsAppUserId ? deps.findCustomerByWhatsAppUserId(bsuid) : null,
      deps.findApplicationByWhatsAppUserId ? deps.findApplicationByWhatsAppUserId(bsuid) : null
    ]);
    if (!customer && !app) {
      logger.info("username sender matches no customer or application", {
        bsuid,
        username: identity.username
      });
      return { type: "guest", phone: identity.address, unmatchedUsername: true };
    }
    return routeByRecords(identity.address, customer, app);
  }

  return async function routeMessage(sender: SenderIdentity | string): Promise<RouteResult> {
    const identity: SenderIdentity =
      typeof sender === "string" ? { address: sender, phone: sender } : sender;
    if (!identity.phone) return routeUsernameSender(identity);

    const normalizedPhone = validatePhone(identity.phone);
    logger.verbose("routing message", { phone: identity.phone, normalizedPhone });

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
    return routeByRecords(normalizedPhone, customer, app);
  };
}
