/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Agents are loaded from the agents YAML file by @mikro/agents (which
 * owns the schema and tool registry), keyed by the profile each serves. The
 * apiserver just re-exports the loader.
 */
import type { Agent, Profile } from "@mikro/agents";
import { loadAgents as loadAgentsFromConfig } from "@mikro/agents";
import { logger } from "../logger.js";

/**
 * Load all agent configurations from agents.yaml, keyed by profile.
 *
 * @returns A Map of profile to Agent configuration
 * @throws Error if the config is missing or any entry is invalid
 */
export function loadAgents(): Map<Profile, Agent> {
  logger.verbose("loading agent configurations");
  const agents = loadAgentsFromConfig();
  logger.verbose("all agents loaded", { count: agents.size, profiles: [...agents.keys()] });
  return agents;
}
