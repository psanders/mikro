/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Message router that determines which agent should handle a message
 * based on the sender's phone number.
 */
import type { RouteResult, RouterDependencies } from "./types.js";
import { logger } from "../logger.js";
import { validateDominicanPhone } from "@mikro/common";

/**
 * Creates a message router that determines routing based on phone number lookup.
 *
 * Routing rules:
 * 1. Member → Log and ignore (members don't use agents)
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
 *   getMemberByPhone: createGetMemberByPhone(db),
 * });
 *
 * const result = await router("+1234567890");
 * // result: { type: "guest", phone: "+1234567890" }
 * // or: { type: "user", userId: "...", role: "COLLECTOR", phone: "..." }
 * ```
 */
export function createMessageRouter(deps: RouterDependencies) {
  const { getUserByPhone, getMemberByPhone } = deps;

  return async function routeMessage(phone: string): Promise<RouteResult> {
    // Normalize phone number to E.164 format (with +)
    const normalizedPhone = validateDominicanPhone(phone);
    logger.verbose("routing message", { phone, normalizedPhone });

    // Step 1: Check if phone belongs to a member
    const member = await getMemberByPhone({ phone: normalizedPhone });
    if (member) {
      // Members don't interact with agents - log and ignore
      logger.verbose("phone belongs to member, ignoring", {
        phone: normalizedPhone,
        memberId: member.id
      });
      return {
        type: "member",
        memberId: member.id,
        phone: normalizedPhone
      };
    }

    // Step 2: Check if phone belongs to a user
    const user = await getUserByPhone({ phone: normalizedPhone });
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

      // Get the user's primary role (prefer ADMIN > COLLECTOR > REFERRER)
      const roles = user.roles.map((r) => r.role);
      let primaryRole: "ADMIN" | "COLLECTOR" | "REFERRER" = "COLLECTOR";

      if (roles.includes("ADMIN")) {
        primaryRole = "ADMIN";
      } else if (roles.includes("COLLECTOR")) {
        primaryRole = "COLLECTOR";
      } else if (roles.includes("REFERRER")) {
        // Referrers don't have a dedicated agent, default to COLLECTOR
        primaryRole = "COLLECTOR";
      }

      logger.verbose("phone belongs to user", {
        phone: normalizedPhone,
        userId: user.id,
        role: primaryRole
      });
      return {
        type: "user",
        userId: user.id,
        role: primaryRole,
        phone: normalizedPhone
      };
    }

    // Step 3: Unknown phone - this is a guest
    logger.verbose("phone is unknown, routing to guest agent", { phone: normalizedPhone });
    return {
      type: "guest",
      phone: normalizedPhone
    };
  };
}
