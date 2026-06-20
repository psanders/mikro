/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Zod schema for validating an agent entry loaded from the agents file
 * (YAML). Owned here (alongside the Agent type and tool registry) so
 * both the apiserver runtime and the eval CLI validate against the same
 * contract. Everything about an agent — including its evaluations — lives in
 * the config file; nothing is hardcoded.
 */
import { z } from "zod/v4";
import { AGENT_PROFILES } from "../constants.js";

/** A single conversation turn in an evaluation scenario (kept lenient — the eval harness owns the deep shape). */
const evalTurnSchema = z
  .object({
    human: z.string().optional(),
    image: z.string().optional(),
    expectedAI: z.string(),
    skipResponseCheck: z.boolean().optional(),
    tools: z
      .array(
        z.object({
          name: z.string(),
          expectedArgs: z.record(z.string(), z.unknown()).optional(),
          matchMode: z.enum(["strict", "judge"]).optional(),
          mockResponse: z.object({
            success: z.boolean(),
            message: z.string(),
            data: z.unknown().optional()
          })
        })
      )
      .optional()
  })
  .loose();

const evaluationsSchema = z.object({
  context: z.record(z.string(), z.unknown()).optional(),
  scenarios: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      turns: z.array(evalTurnSchema)
    })
  )
});

/** Schema for a single agent entry in the agents YAML file. */
export const agentConfigSchema = z.object({
  name: z.string().min(1, "Agent name is required"),
  profile: z.enum(AGENT_PROFILES),
  /** Whether the agent serves its profile. Defaults to true (enabled). */
  enabled: z.boolean().default(true),
  systemPrompt: z.string().min(1, "System prompt is required"),
  allowedTools: z.array(z.string()).min(0, "Allowed tools must be an array"),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  // Which text becomes the user-facing reply when the model emits text both
  // alongside a tool call and after the tool result. "final" (default) uses the
  // post-tool text (falling back to the alongside-tool text); "pre-tool" prefers
  // the alongside-tool text. Agents whose reply is generated AFTER seeing tool
  // results (e.g. José's intake) want "final"; agents that reply alongside the
  // call (e.g. María's "¡Listo!") want "pre-tool".
  replyMode: z.enum(["final", "pre-tool"]).default("final"),
  /** Optional evaluation suite (used by the eval CLI; ignored at runtime). */
  evaluations: evaluationsSchema.optional()
});

/** Input type for a parsed agent entry. */
export type AgentConfigInput = z.infer<typeof agentConfigSchema>;
