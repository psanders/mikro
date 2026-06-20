/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Agent identity constants. Agents are identified by audience profile only —
 * there are no agent names in code. Profile is the canonical domain type and
 * lives in @mikro/common (alongside Role); re-exported here for agent code.
 */
import { AGENT_PROFILES } from "@mikro/common";

export { AGENT_PROFILES, type Profile } from "@mikro/common";

/**
 * Set of valid profiles for validation.
 */
export const VALID_AGENT_PROFILES = new Set<string>(AGENT_PROFILES);
