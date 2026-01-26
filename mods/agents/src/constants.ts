/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Agent name constants and utilities.
 */

/**
 * Agent name constants for easy reference.
 */
export const AGENT_JOAN = "joan" as const;
export const AGENT_JUAN = "juan" as const;
export const AGENT_MARIA = "maria" as const;

/**
 * Available agent names.
 */
export const AGENT_NAMES = [AGENT_JOAN, AGENT_JUAN, AGENT_MARIA] as const;

/**
 * Type for agent names.
 */
export type AgentName = (typeof AGENT_NAMES)[number];

/**
 * Set of valid agent names for validation.
 */
export const VALID_AGENT_NAMES = new Set(AGENT_NAMES);

/**
 * Mapping of user roles to agent names.
 */
export const ROLE_TO_AGENT = {
  ADMIN: AGENT_MARIA,
  COLLECTOR: AGENT_JUAN,
  REFERRER: AGENT_JUAN // Referrers default to COLLECTOR agent
} as const;

/**
 * Agent name for guest users.
 */
export const GUEST_AGENT = AGENT_JOAN;
