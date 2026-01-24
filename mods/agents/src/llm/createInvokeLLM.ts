/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import OpenAI from "openai";
import { getOpenAIApiKey } from "../config.js";
import { logger } from "../logger.js";
import type {
  Agent,
  Message,
  MessageContentItem,
  ToolFunction,
  ToolExecutor,
  ToolCall
} from "./types.js";

// Singleton OpenAI client
let openaiClient: OpenAI | null = null;

/**
 * Get or create OpenAI client instance.
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = getOpenAIApiKey();
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Filter tools based on agent's allowed tools.
 */
function filterTools(allTools: ToolFunction[], allowedTools: string[]): ToolFunction[] {
  const toolMap = new Map(allTools.map(tool => [tool.function.name, tool]));
  return allowedTools
    .map(name => toolMap.get(name))
    .filter((tool): tool is ToolFunction => tool !== undefined);
}

/**
 * Creates an LLM invocation function with the given configuration.
 *
 * The returned function accepts messages directly (no internal history fetching),
 * making it pure and easy to test.
 *
 * @param agent - The agent configuration (systemPrompt, model, temperature, allowedTools)
 * @param allTools - All available tool definitions
 * @param toolExecutor - Function to execute tools when called by the LLM
 * @returns A function that invokes the LLM with the given messages
 *
 * @example
 * ```typescript
 * const invokeLLM = createInvokeLLM(joanAgent, tools, toolExecutor);
 *
 * const response = await invokeLLM(
 *   chatHistory,
 *   "Hello, I want to sign up",
 *   null // no image
 * );
 * ```
 */
export function createInvokeLLM(
  agent: Agent,
  allTools: ToolFunction[],
  toolExecutor: ToolExecutor
) {
  const client = getOpenAIClient();
  const agentTools = filterTools(allTools, agent.allowedTools);

  /**
   * Invoke the LLM with the given messages and user input.
   *
   * @param messages - Existing chat history (without system prompt)
   * @param userMessage - The current user message text
   * @param imageUrl - Optional base64 data URL for image (for vision)
   * @param context - Optional context to pass to tool executor (e.g., phone number)
   * @returns The assistant's text response
   */
  return async function invokeLLM(
    messages: Message[],
    userMessage: string,
    imageUrl?: string | null,
    context?: Record<string, unknown>
  ): Promise<string> {
    logger.verbose("invoking llm", { 
      agent: agent.name, 
      historyLength: messages.length,
      hasImage: !!imageUrl 
    });

    // Build the full messages array with system prompt
    const fullMessages: Message[] = [
      { role: "system", content: agent.systemPrompt },
      ...messages
    ];

    // Build current user message content
    const userContent: MessageContentItem[] = [];

    // Add text message
    if (userMessage) {
      userContent.push({
        type: "text",
        text: userMessage
      });
    }

    // Add image if provided (and it's a valid data URL, not a placeholder)
    if (imageUrl && !imageUrl.startsWith("https://example.com/")) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: imageUrl
        }
      });
    }

    // If no content, add default
    if (userContent.length === 0) {
      userContent.push({
        type: "text",
        text: "Hello"
      });
    }

    // Add current user message
    fullMessages.push({
      role: "user",
      content: userContent
    });

    try {
      // Call OpenAI
      let response = await client.chat.completions.create({
        model: agent.model || "gpt-4o",
        messages: fullMessages as Parameters<typeof client.chat.completions.create>[0]["messages"],
        tools: agentTools.length > 0 ? agentTools as Parameters<typeof client.chat.completions.create>[0]["tools"] : undefined,
        tool_choice: agentTools.length > 0 ? "auto" : undefined,
        temperature: agent.temperature ?? 0.7
      });

      let assistantMessage = response.choices[0].message;
      let finalResponse = "";

      // Handle tool calls loop
      while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Filter to only function type tool calls
        const functionCalls = assistantMessage.tool_calls.filter(
          (tc): tc is typeof tc & { type: "function"; function: { name: string; arguments: string } } =>
            tc.type === "function" && "function" in tc
        );

        logger.verbose("tool calls detected", { 
          agent: agent.name, 
          tools: functionCalls.map(tc => tc.function.name) 
        });

        // Add assistant message with tool calls to conversation
        fullMessages.push({
          role: "assistant",
          content: assistantMessage.content || "",
          tool_calls: functionCalls.map(tc => ({
            id: tc.id,
            type: tc.type,
            function: tc.function
          })) as ToolCall[]
        });

        // Execute all tool calls
        const toolResults: Message[] = [];
        for (const toolCall of functionCalls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;

          logger.verbose("executing tool", { agent: agent.name, tool: toolName, args: toolArgs });

          // Execute the tool
          const result = await toolExecutor(toolName, toolArgs, context);

          logger.verbose("tool executed", { 
            agent: agent.name, 
            tool: toolName, 
            success: result.success 
          });

          toolResults.push({
            role: "tool",
            content: JSON.stringify(result),
            name: toolName,
            tool_call_id: toolCall.id
          });
        }

        // Add tool results to conversation
        fullMessages.push(...toolResults);

        // Get next response from OpenAI
        response = await client.chat.completions.create({
          model: agent.model || "gpt-4o",
          messages: fullMessages as Parameters<typeof client.chat.completions.create>[0]["messages"],
          tools: agentTools.length > 0 ? agentTools as Parameters<typeof client.chat.completions.create>[0]["tools"] : undefined,
          tool_choice: agentTools.length > 0 ? "auto" : undefined,
          temperature: agent.temperature ?? 0.7
        });

        assistantMessage = response.choices[0].message;
      }

      // Get final text response
      finalResponse = assistantMessage.content || "";

      logger.verbose("llm response received", { 
        agent: agent.name, 
        responseLength: finalResponse.length 
      });

      return finalResponse;
    } catch (error) {
      const err = error as Error;
      logger.error("llm invocation failed", { agent: agent.name, error: err.message });
      throw error;
    }
  };
}
