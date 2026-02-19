/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Role } from "@mikro/common";
import type { AgentName } from "../constants.js";

/**
 * Result of routing a message.
 */
export type RouteResult =
  | { type: "guest"; phone: string }
  | { type: "user"; userId: string; name: string; role: Role; phone: string }
  | { type: "customer"; customerId: string; phone: string }
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
  /** Check if an agent is disabled */
  isAgentDisabled: (agentName: AgentName) => boolean;
}
