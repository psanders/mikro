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
  /**
   * José's application. `intake`: a DRAFT he gets submitted. `enrichment`: a
   * submitted (RECEIVED) application whose remaining form fields he still
   * asks while the conversation is live (openspec jose-keep-gathering).
   */
  | {
      type: "prospect";
      applicationId: string;
      sessionId: string;
      phone: string;
      phase?: "intake" | "enrichment";
    }
  /** Never-submitted ABANDONED application: reopen to DRAFT, then José. */
  | { type: "reopen"; applicationId: string; sessionId: string; phone: string }
  /** Application in the review pipeline (RECEIVED → APPROVED). */
  | { type: "applicant"; applicationId: string; sessionId: string; phone: string }
  /**
   * `previouslyRejected`: their latest application was REJECTED less than the
   * reapply cooldown ago; `reapplyFrom` is when they may apply again.
   * `outOfArea`: their latest application was rejected because the business
   * is outside the coverage area; there is no reapply date for that.
   * `unmatchedUsername`: a WhatsApp username sender (no phone) we can't tie
   * to any customer or application; a person takes these.
   */
  | {
      type: "guest";
      phone: string;
      previouslyRejected?: true;
      reapplyFrom?: Date;
      outOfArea?: true;
      unmatchedUsername?: true;
    }
  | { type: "ignored"; reason: string; phone: string };

/** The latest application for a phone, as the router needs it. */
export interface ApplicationLookupResult {
  applicationId: string;
  sessionId: string;
  status: ApplicationStatus;
  submittedAt: Date | null;
  /** When it was approved or rejected; optional for older callers. */
  decidedAt?: Date | null;
  /** Why it was rejected (e.g. OUT_OF_COVERAGE_AREA); optional for older callers. */
  rejectionReason?: string | null;
  /** RECEIVED and José still asks its missing fields (the lookup decides). */
  intakeOpen?: boolean;
}

/**
 * Who sent a message. `address` is where replies go and what conversations are
 * keyed by: the phone when Meta included it, otherwise the business-scoped
 * user id (BSUID) of a sender who hides their number behind a WhatsApp
 * username. In every route, `phone` carries this address.
 */
export interface SenderIdentity {
  address: string;
  /** E.164 phone, when Meta included it. */
  phone?: string;
  /** Business-scoped user id, e.g. "DO.1610031533916997". */
  bsuid?: string;
  /** WhatsApp username, when the sender has one. */
  username?: string;
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
  /** Optional: the customer a WhatsApp BSUID was linked to (username senders). */
  findCustomerByWhatsAppUserId?: (bsuid: string) => Promise<CustomerLookupResult | null>;
  /** Optional: the latest application linked to a WhatsApp BSUID (username senders). */
  findApplicationByWhatsAppUserId?: (bsuid: string) => Promise<ApplicationLookupResult | null>;
}
