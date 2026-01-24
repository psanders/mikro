/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Agent } from "@mikro/agents";
import { logger } from "../logger.js";
import { agentConfigSchema } from "./agentSchema.js";
import { joan } from "./joan.js";
import { juan } from "./juan.js";
import { maria } from "./maria.js";

/**
 * Available agent names.
 */
export type AgentName = "joan" | "juan" | "maria";

/**
 * Load a single agent configuration from TypeScript module.
 * Uses Zod validation following the same pattern as API functions.
 *
 * @param agent - The agent configuration object
 * @param name - The agent name (for validation and logging)
 * @returns The validated agent configuration
 */
function validateAgentConfig(agent: unknown, name: AgentName): Agent {
  // Validate using Zod schema (same validation approach as withErrorHandlingAndValidation)
  const result = agentConfigSchema.safeParse(agent);
  if (!result.success) {
    const errorMessages = result.error.issues
      .map((e) => `${e.path.map(String).join(".")}: ${e.message}`)
      .join(", ");
    throw new Error(`Invalid agent configuration for ${name}: ${errorMessages}`);
  }

  return result.data as Agent;
}

/**
 * Load all agent configurations.
 *
 * @returns A Map of agent name to Agent configuration
 */
export function loadAgents(): Map<AgentName, Agent> {
  logger.verbose("loading agent configurations");

  const agents = new Map<AgentName, Agent>();
  const agentConfigs: Array<{ name: AgentName; config: unknown }> = [
    { name: "joan", config: joan },
    { name: "juan", config: juan },
    { name: "maria", config: maria }
  ];

  for (const { name, config } of agentConfigs) {
    try {
      const agent = validateAgentConfig(config, name);
      agents.set(name, agent);
      logger.verbose("agent loaded", { name, tools: agent.allowedTools.length });
    } catch (error) {
      const err = error as Error;
      logger.error("failed to load agent", { name, error: err.message });
      throw error;
    }
  }

  logger.verbose("all agents loaded", { count: agents.size });
  return agents;
}

/**
 * Get a specific agent by name.
 *
 * @param agents - The agents map
 * @param name - The agent name to get
 * @returns The agent configuration
 * @throws Error if agent not found
 */
export function getAgent(agents: Map<AgentName, Agent>, name: AgentName): Agent {
  const agent = agents.get(name);
  if (!agent) {
    throw new Error(`Agent not found: ${name}`);
  }
  return agent;
}
