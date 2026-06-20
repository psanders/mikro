/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Agent registry — single source for all agent definitions.
 */
import type { Agent } from "../llm/types.js";
import type { AgentName } from "../constants.js";
import { jose } from "./jose/index.js";
import { maria } from "./maria/index.js";

export { jose } from "./jose/index.js";
export { JOSE_SYSTEM_PROMPT } from "./jose/systemPrompt.js";
export { maria } from "./maria/index.js";

export function loadAgents(): Map<AgentName, Agent> {
  const agents = new Map<AgentName, Agent>();
  agents.set("maria", maria);
  agents.set("jose", jose);
  return agents;
}
