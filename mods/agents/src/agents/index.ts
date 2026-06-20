/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Agent registry — loads agent definitions from the agents YAML file,
 * validates each entry, and verifies its tools exist. Agents are keyed by
 * profile (their sole identity in code); everything about an agent, evaluations
 * included, lives in the config file. Nothing is hardcoded.
 */
import { loadRawAgentsConfig } from "@mikro/common";
import type { Agent } from "../llm/types.js";
import type { Profile } from "../constants.js";
import { getToolByName } from "../tools/index.js";
import { agentConfigSchema } from "./agentSchema.js";

export { agentConfigSchema, type AgentConfigInput } from "./agentSchema.js";

/**
 * Validate a single raw agent entry: schema and tool existence.
 *
 * @throws Error identifying the offending agent (by display label) and the problem
 */
function buildAgent(raw: unknown, index: number): Agent {
  const parsed = agentConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((e) => `${e.path.map(String).join(".")}: ${e.message}`)
      .join(", ");
    const label =
      raw && typeof raw === "object" && "name" in raw
        ? String((raw as { name: unknown }).name)
        : `index ${index}`;
    throw new Error(`Invalid agent configuration for ${label}: ${issues}`);
  }

  const config = parsed.data;

  const unknownTools = config.allowedTools.filter((t) => !getToolByName(t));
  if (unknownTools.length > 0) {
    throw new Error(
      `Agent for profile "${config.profile}" references tool(s) with no implementation: ${unknownTools.join(", ")}.`
    );
  }

  return config as Agent;
}

/**
 * Load all agents from the agents file, keyed by the profile each serves.
 * Validates every entry and fails fast on the first invalid one, or on a
 * profile claimed by more than one agent.
 *
 * @throws Error if the config is missing/invalid or a profile is claimed twice
 */
export function loadAgents(): Map<Profile, Agent> {
  const raw = loadRawAgentsConfig();
  const agents = new Map<Profile, Agent>();

  raw.forEach((entry, i) => {
    const agent = buildAgent(entry, i);

    // A profile is served by at most one agent — reject ambiguous config.
    const existing = agents.get(agent.profile);
    if (existing) {
      throw new Error(
        `Profile "${agent.profile}" is claimed by multiple agents ("${existing.name}" and "${agent.name}"). ` +
          `Each profile may be served by at most one agent.`
      );
    }

    agents.set(agent.profile, agent);
  });

  return agents;
}

/**
 * Resolve the agent that serves a given profile, or undefined when none is
 * assigned (e.g. COLLECTOR or GUEST with no configured agent).
 */
export function getAgentByProfile(
  agents: Map<Profile, Agent>,
  profile: Profile
): Agent | undefined {
  return agents.get(profile);
}
