/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ApplicationStatus, Role } from "@mikro/common";
import type { Agent } from "../llm/types.js";
import type { Profile } from "../constants.js";

/**
 * Result of routing a message. Each variant names who is writing, which picks
 * the profile (and so the agent) that answers (openspec cx-role-based-agents):
 * `customer` → CUSTOMER, `prospect`/`reopen` → PROSPECT, `applicant` →
 * APPLICANT, `guest` → GUEST, `user` → the user's role.
 */
export type RouteResult =
  | { type: "user"; userId: string; name: string; role: Role; phone: string }
  | {
      type: "customer";
      customerId: string;
      name: string;
      phone: string;
      /** A new application of theirs in the review pipeline, if any. */
      applicationId?: string;
    }
  /** DRAFT application: José finishes the intake. */
  | { type: "prospect"; applicationId: string; sessionId: string; phone: string }
  /** Never-submitted ABANDONED application: reopen to DRAFT, then José. */
  | { type: "reopen"; applicationId: string; sessionId: string; phone: string }
  /** Application in the review pipeline (RECEIVED → APPROVED). */
  | { type: "applicant"; applicationId: string; sessionId: string; phone: string }
  /** `previouslyRejected`: their latest application was REJECTED. */
  | { type: "guest"; phone: string; previouslyRejected?: true }
  | { type: "ignored"; reason: string; phone: string };

/** The latest application for a phone, as the router needs it. */
export interface ApplicationLookupResult {
  applicationId: string;
  sessionId: string;
  status: ApplicationStatus;
  submittedAt: Date | null;
}

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
  /** Optional: look up the most recent loan application for a phone (prospect/applicant routing). */
  findApplicationByPhone?: (phone: string) => Promise<ApplicationLookupResult | null>;
}
