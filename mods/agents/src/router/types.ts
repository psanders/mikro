/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Role } from "@mikro/common";
import type { Agent } from "../llm/types.js";
import type { Profile } from "../constants.js";

/**
 * Result of routing a message.
 */
export type RouteResult =
  | { type: "user"; userId: string; name: string; role: Role; phone: string }
  | { type: "customer"; customerId: string; phone: string }
  | { type: "prospect"; sessionId: string; partial: boolean; phone: string }
  | { type: "guest"; phone: string }
  | { type: "ignored"; reason: string; phone: string };

/**
 * User with roles from database lookup.
 */
export interface UserLookupResult {
  id: string;
  name: string;
  phone: string;
  enabled: boolean;
  roles: Array<{ role: Role }>;
}

/**
 * Customer from database lookup.
 */
export interface CustomerLookupResult {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
}

/**
 * Dependencies for the message router.
 */
export interface RouterDependencies {
  /** Get user by phone number */
  getUserByPhone: (params: { phone: string }) => Promise<UserLookupResult | null>;
  /** Get customer by phone number */
  getCustomerByPhone: (params: { phone: string }) => Promise<CustomerLookupResult | null>;
  /**
   * Resolve the agent serving a profile, or undefined when none is assigned or
   * the profile is disabled. This is the sole agent-resolution hook — the router
   * never deals in agent names.
   */
  getAgentForProfile: (profile: Profile) => Agent | undefined;
  /** Optional: look up the most recent loan application for a phone (for prospect routing). */
  findApplicationByPhone?: (
    phone: string
  ) => Promise<{ sessionId: string; partial: boolean } | null>;
}
