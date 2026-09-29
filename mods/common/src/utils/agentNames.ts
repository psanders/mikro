/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Display names for the WhatsApp CX agents. Agent names come from agents.yaml
 * (`jose`, `sofia`, …); unknown names are capitalized as-is.
 */
const AGENT_NAMES: Record<string, string> = {
  jose: "José",
  lucia: "Lucía",
  sofia: "Sofía",
  carmen: "Carmen"
};

/** "sofia" → "Sofía". */
export function agentDisplayName(name: string | null | undefined): string {
  if (!name) return "Agente";
  return AGENT_NAMES[name] ?? name.charAt(0).toUpperCase() + name.slice(1);
}
