/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Message router that determines which agent should handle a message
 * based on the sender's phone number.
 */
import type { RouteResult, RouterDependencies } from "./types.js";
import { logger } from "../logger.js";
import { validatePhone } from "@mikro/common";
import { ROLE_TO_AGENT } from "../constants.js";

/**
 * Creates a message router that determines routing based on phone number lookup.
 *
 * Routing rules:
 * 1. Customer → Log and ignore (customers don't use agents)
 * 2. User (COLLECTOR role) → Route to Juan agent
 * 3. User (ADMIN role) → Route to Maria agent
 * 4. Unknown phone (Guest) → Route to Joan agent for onboarding
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
  const { getUserByPhone, getCustomerByPhone, isAgentDisabled } = deps;

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

      // Determine which agent would handle this user
      const targetAgent = ROLE_TO_AGENT[primaryRole];

      // No agent configured for this role (e.g. collectors use the mobile app)
      if (!targetAgent) {
        logger.verbose("no agent configured for role, ignoring", {
          phone: normalizedPhone,
          role: primaryRole
        });
        return {
          type: "ignored",
          reason: "no agent for this role",
          phone: normalizedPhone
        };
      }

      // Check if the target agent is disabled
      if (isAgentDisabled(targetAgent)) {
        logger.info("agent is disabled, ignoring request", {
          phone: normalizedPhone,
          agentName: targetAgent,
          routeType: "user",
          userId: user.id,
          role: primaryRole,
          reason: "agent is disabled"
        });
        return {
          type: "ignored",
          reason: "agent is disabled",
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

    // Step 3: Unknown phone — no onboarding agent. Mikro does not onboard
    // prospects over WhatsApp, so the AI never replies to new/unknown numbers.
    logger.verbose("phone is unknown, ignoring (no onboarding agent)", { phone: normalizedPhone });
    return {
      type: "ignored",
      reason: "unknown phone — onboarding over WhatsApp is disabled",
      phone: normalizedPhone
    };
  };
}
