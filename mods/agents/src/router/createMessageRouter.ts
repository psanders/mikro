/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Message router that determines which agent should handle a message
 * based on the sender's phone number.
 */
import type { RouteResult, RouterDependencies } from "./types.js";
import { logger } from "../logger.js";
import { validatePhone } from "@mikro/common";

/**
 * Creates a message router that determines routing based on phone number lookup.
 *
 * Routing rules (the agent that serves each profile is assigned in agents.yaml;
 * a route resolves to an agent only if one is assigned to that profile):
 * 1. Customer → Log and ignore (customers don't use agents)
 * 2. User → resolve the agent for the user's role profile (ADMIN/COLLECTOR);
 *    ignored when no agent is assigned to that profile
 * 3. Unknown phone with a partial application → prospect (PROSPECT profile)
 * 4. Unknown phone with no application → guest (GUEST profile)
 *
 * @param deps - Dependencies for database lookups
 * @returns A function that routes messages based on phone number
 *
 * @example
 * ```typescript
 * const router = createMessageRouter({
 *   getUserByPhone: createGetUserByPhone(db),
 *   getCustomerByPhone: createGetCustomerByPhone(db),
 * });
 *
 * const result = await router("+1234567890");
 * // result: { type: "guest", phone: "+1234567890" }
 * // or: { type: "user", userId: "...", role: "COLLECTOR", phone: "..." }
 * ```
 */
export function createMessageRouter(deps: RouterDependencies) {
  const { getUserByPhone, getCustomerByPhone, getAgentForProfile } = deps;

  return async function routeMessage(phone: string): Promise<RouteResult> {
    // Normalize phone number to E.164 format (with +)
    const normalizedPhone = validatePhone(phone);
    logger.verbose("routing message", { phone, normalizedPhone });

    // Run customer and user lookups in parallel (independent queries)
    const [customer, user] = await Promise.all([
      getCustomerByPhone({ phone: normalizedPhone }),
      getUserByPhone({ phone: normalizedPhone })
    ]);

    // Step 1: Customer takes precedence (customers don't interact with agents)
    if (customer) {
      logger.verbose("phone belongs to customer, ignoring", {
        phone: normalizedPhone,
        customerId: customer.id
      });
      return {
        type: "customer",
        customerId: customer.id,
        phone: normalizedPhone
      };
    }

    // Step 2: Check if phone belongs to a user
    if (user) {
      // Check if user is enabled
      if (!user.enabled) {
        logger.verbose("user is disabled, ignoring", { phone: normalizedPhone, userId: user.id });
        return {
          type: "ignored",
          reason: "user is disabled",
          phone: normalizedPhone
        };
      }

      // Get the user's primary role (prefer ADMIN > COLLECTOR)
      const roles = user.roles.map((r) => r.role);
      let primaryRole: "ADMIN" | "COLLECTOR" = "COLLECTOR";

      if (roles.includes("ADMIN")) {
        primaryRole = "ADMIN";
      } else if (roles.includes("COLLECTOR")) {
        primaryRole = "COLLECTOR";
      }

      // No agent serving this profile (none assigned, or the profile is
      // disabled — getAgentForProfile collapses both to undefined).
      if (!getAgentForProfile(primaryRole)) {
        logger.verbose("no agent serving profile, ignoring", {
          phone: normalizedPhone,
          profile: primaryRole
        });
        return {
          type: "ignored",
          reason: "no agent for this profile",
          phone: normalizedPhone
        };
      }

      logger.verbose("phone belongs to user", {
        phone: normalizedPhone,
        userId: user.id,
        role: primaryRole
      });
      return {
        type: "user",
        userId: user.id,
        name: user.name,
        role: primaryRole,
        phone: normalizedPhone
      };
    }

    // Step 3: Unknown phone — check for a prospect loan application.
    if (deps.findApplicationByPhone) {
      const app = await deps.findApplicationByPhone(normalizedPhone);
      if (app) {
        logger.verbose("phone matched prospect loan application", {
          phone: normalizedPhone,
          sessionId: app.sessionId,
          partial: app.partial
        });
        return {
          type: "prospect",
          sessionId: app.sessionId,
          partial: app.partial,
          phone: normalizedPhone
        };
      }
    }

    // Step 4: Unknown phone, no application — guest. The handler responds only
    // if an agent is assigned to the GUEST profile; otherwise it ignores.
    logger.verbose("phone is unknown — routing as guest", { phone: normalizedPhone });
    return { type: "guest", phone: normalizedPhone };
  };
}
