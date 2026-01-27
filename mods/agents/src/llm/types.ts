/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

/**
 * Model settings for LLM inference.
 */
export interface ModelSettings {
  /** The model to use (e.g., "gpt-4o", "gpt-4o-mini") */
  model: string;
  /** Temperature for response randomness (0-2, default 0.7) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
}

/**
 * Agent configuration loaded from JSON.
 */
export interface Agent {
  /** Agent name (e.g., "joan", "juan", "maria") */
  name: string;
  /** System prompt that defines the agent's behavior */
  systemPrompt: string;
  /** List of tool names the agent is allowed to use */
  allowedTools: string[];
  /** The LLM model to use */
  model: string;
  /** Temperature setting for the model */
  temperature: number;
  /** Optional evaluation configuration */
  evaluations?: AgentEvaluation;
}

/**
 * Message content item (for multimodal messages).
 */
export interface MessageContentItem {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
  };
}

/**
 * Message in conversation history.
 * Content can be a string or array for multimodal messages.
 */
export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | MessageContentItem[];
  /** Tool calls from assistant (for tool call messages) */
  tool_calls?: ToolCall[];
  /** Tool name (for tool response messages) */
  name?: string;
  /** Tool call ID (for tool response messages) */
  tool_call_id?: string;
}

/**
 * Tool call from the LLM.
 */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * OpenAI function tool definition.
 */
export interface ToolFunction {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<
        string,
        {
          type: string;
          description: string;
          enum?: string[];
        }
      >;
      required: string[];
    };
  };
}

/**
 * Result from executing a tool.
 */
export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * Tool executor function type.
 * Takes tool name, arguments, and optional context, returns tool result.
 */
export type ToolExecutor = (
  toolName: string,
  args: Record<string, unknown>,
  context?: Record<string, unknown>
) => Promise<ToolResult>;

/**
 * Mode for argument verification in evaluations.
 */
export type ArgMatchMode = "strict" | "judge";

/**
 * Expected tool call with verification and mock data.
 */
export interface ExpectedToolCall {
  /** Tool name that should be called */
  name: string;
  /** Expected arguments - verified against actual args */
  expectedArgs?: Record<string, unknown>;
  /** How to match arguments: "strict" (exact) or "judge" (LLM semantic) */
  matchMode?: ArgMatchMode;
  /** Mock response returned by the tool during eval */
  mockResponse: ToolResult;
}

/**
 * A single conversation turn in an evaluation scenario.
 */
export interface ConversationTurn {
  /** Human input message (optional if image provided) */
  human?: string;
  /** Optional image as URL or base64 data URL (e.g., "data:image/jpeg;base64,...") */
  image?: string;
  /** Expected AI response */
  expectedAI: string;
  /** Optional tool calls expected in this turn */
  tools?: ExpectedToolCall[];
}

/**
 * Evaluation scenario containing multiple conversation turns.
 */
export interface EvaluationScenario {
  /** Unique identifier for the scenario */
  id: string;
  /** Description of what the scenario tests */
  description: string;
  /** Conversation turns in order */
  turns: ConversationTurn[];
}

/**
 * Evaluation configuration for an agent.
 */
export interface AgentEvaluation {
  /** Context that emulates production environment */
  context?: Record<string, unknown>;
  /** Scenarios to test */
  scenarios: EvaluationScenario[];
}
