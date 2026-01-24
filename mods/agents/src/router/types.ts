/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Role } from "@mikro/common";

/**
 * Result of routing a message.
 */
export type RouteResult =
  | { type: "guest"; phone: string }
  | { type: "user"; userId: string; role: Role; phone: string }
  | { type: "member"; memberId: string; phone: string }
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
 * Member from database lookup.
 */
export interface MemberLookupResult {
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
  /** Get member by phone number */
  getMemberByPhone: (params: { phone: string }) => Promise<MemberLookupResult | null>;
}
