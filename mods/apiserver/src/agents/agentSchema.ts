/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";

/**
 * Schema for validating agent configuration loaded from JSON.
 */
export const agentConfigSchema = z.object({
  name: z.string().min(1, "Agent name is required"),
  systemPrompt: z.string().min(1, "System prompt is required"),
  allowedTools: z.array(z.string()).min(0, "Allowed tools must be an array"),
  model: z.string().min(1, "Model is required"),
  temperature: z.number().min(0).max(2).default(0.7),
  evaluations: z
    .object({
      context: z.record(z.string(), z.any()).optional(),
      scenarios: z.array(z.any()).optional()
    })
    .optional()
});

/**
 * Input type for agent configuration.
 */
export type AgentConfigInput = z.infer<typeof agentConfigSchema>;
