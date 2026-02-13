/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  ToolMessage,
  type BaseMessage
} from "@langchain/core/messages";
import type { Runnable } from "@langchain/core/runnables";
import { getLLMConfig } from "../config.js";
import { createChatModel, isVisionModel } from "./providers.js";
import { logger } from "../logger.js";
import type { Agent, Message, MessageContentItem, ToolFunction, ToolExecutor } from "./types.js";

/**
 * Content block types for multimodal messages.
 */
type TextContent = { type: "text"; text: string };
type ImageUrlContent = { type: "image_url"; image_url: { url: string } };
type MessageContent = TextContent | ImageUrlContent;

/**
 * Filter tools based on agent's allowed tools.
 */
function filterTools(allTools: ToolFunction[], allowedTools: string[]): ToolFunction[] {
  const toolMap = new Map(allTools.map((tool) => [tool.function.name, tool]));
  return allowedTools
    .map((name) => toolMap.get(name))
    .filter((tool): tool is ToolFunction => tool !== undefined);
}

/**
 * Convert internal Message format to LangChain BaseMessage format.
 */
function convertToLangChainMessage(msg: Message): BaseMessage {
  if (msg.role === "system") {
    return new SystemMessage(typeof msg.content === "string" ? msg.content : "");
  }

  if (msg.role === "user") {
    if (typeof msg.content === "string") {
      // Guard against empty user messages (Anthropic rejects them)
      return new HumanMessage(msg.content || "[Message]");
    }
    // Multimodal message
    const content: MessageContent[] = msg.content.map((item) => {
      if (item.type === "text") {
        return { type: "text", text: item.text || "" };
      }
      return {
        type: "image_url",
        image_url: { url: item.image_url?.url || "" }
      };
    });
    return new HumanMessage({ content });
  }

  if (msg.role === "assistant") {
    const aiMsg = new AIMessage(typeof msg.content === "string" ? msg.content : "");
    // Add tool calls if present
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      aiMsg.tool_calls = msg.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments),
        type: "tool_call" as const
      }));
    }
    return aiMsg;
  }

  if (msg.role === "tool") {
    return new ToolMessage({
      content: typeof msg.content === "string" ? msg.content : "",
      tool_call_id: msg.tool_call_id || "",
      name: msg.name
    });
  }

  throw new Error(`Unknown message role: ${msg.role}`);
}

/**
 * Truncate large data in tool results to prevent token limit errors.
 */
function truncateToolResult(result: { success: boolean; message: string; data?: unknown }): {
  success: boolean;
  message: string;
  data?: unknown;
} {
  if (!result.data || typeof result.data !== "object" || result.data === null) {
    return result;
  }

  const data = result.data as Record<string, unknown>;
  const truncatedData: Record<string, unknown> = { ...data };

  // If result contains base64 image data in receipt, replace with placeholder
  if (truncatedData.receipt && typeof truncatedData.receipt === "object") {
    const receipt = truncatedData.receipt as Record<string, unknown>;
    if (typeof receipt.image === "string" && receipt.image.length > 1000) {
      const imageSize = receipt.image.length;
      truncatedData.receipt = {
        ...receipt,
        image: `[Base64 image data truncated - ${Math.round(imageSize / 1024)}KB - receipt generated successfully]`
      };
      logger.verbose("truncated large image in tool result", { originalSize: imageSize });
    }
  }

  // If result contains base64 image data directly
  if (typeof truncatedData.image === "string" && truncatedData.image.length > 1000) {
    const imageSize = truncatedData.image.length;
    truncatedData.image = `[Base64 image data truncated - ${Math.round(imageSize / 1024)}KB - receipt generated successfully]`;
    logger.verbose("truncated large image in tool result", { originalSize: imageSize });
  }

  // Truncate any other large string fields (>10KB)
  for (const [key, value] of Object.entries(truncatedData)) {
    if (typeof value === "string" && value.length > 10000 && key !== "token") {
      truncatedData[key] = `[Large data truncated - ${Math.round(value.length / 1024)}KB]`;
      logger.verbose("truncated large field in tool result", {
        field: key,
        originalSize: value.length
      });
    }
  }

  return { ...result, data: truncatedData };
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
  const agentTools = filterTools(allTools, agent.allowedTools);

  // Convert OpenAI tool format to LangChain tool format for bindTools
  const langchainTools = agentTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters
    }
  }));

  /**
   * Invoke the LLM with the given messages and user input.
   *
   * @param messages - Existing chat history (without system prompt)
   * @param userMessage - The current user message text
   * @param imageUrl - Optional base64 data URL for image (for vision)
   * @param context - Optional context to pass to tool executor (e.g., phone number)
   * @param isNewSession - Optional. If true (default), inject directive for full greeting when user greets. If false, inject directive to continue without re-introducing.
   * @returns The assistant's text response
   */
  return async function invokeLLM(
    messages: Message[],
    userMessage: string,
    imageUrl?: string | null,
    context?: Record<string, unknown>,
    isNewSession: boolean = true
  ): Promise<string> {
    logger.verbose("invoking llm", {
      agent: agent.name,
      historyLength: messages.length,
      hasImage: !!imageUrl,
      isNewSession
    });

    // Determine if we need vision model
    const hasImage = imageUrl && !imageUrl.startsWith("https://example.com/");
    const purpose = hasImage ? "vision" : "text";

    // Get LLM config and create model
    const config = getLLMConfig(purpose);

    // Validate vision capability if needed
    if (hasImage && !isVisionModel(config.vendor, config.model)) {
      throw new Error(
        `Model "${config.model}" for vendor "${config.vendor}" does not support vision. ` +
          `Configure MIKRO_LLM_VISION with a vision-capable model.`
      );
    }

    // Create chat model with agent's temperature
    const model = createChatModel(config, { temperature: agent.temperature ?? 0.7 });

    // Bind tools if available - bindTools returns a Runnable

    const modelWithTools: Runnable =
      langchainTools.length > 0 && model.bindTools
        ? model.bindTools(langchainTools, { tool_choice: "auto" })
        : model;

    // Build system message with session directive
    const sessionDirective = isNewSession
      ? "[NUEVA SESIÓN - Preséntate al usuario cuando te salude]\n\n"
      : "[SESIÓN ACTIVA - NO te presentes, continúa la conversación directamente]\n\n";
    const systemContent = sessionDirective + agent.systemPrompt;

    // Convert existing messages to LangChain format
    const langchainMessages: BaseMessage[] = [
      new SystemMessage(systemContent),
      ...messages.map(convertToLangChainMessage)
    ];

    // Build current user message content
    const userContent: MessageContentItem[] = [];

    if (userMessage) {
      userContent.push({ type: "text", text: userMessage });
    }

    if (hasImage) {
      userContent.push({
        type: "image_url",
        image_url: { url: imageUrl }
      });
    }

    if (userContent.length === 0) {
      userContent.push({ type: "text", text: "Hello" });
    }

    // Add current user message
    if (userContent.length === 1 && userContent[0].type === "text") {
      langchainMessages.push(new HumanMessage(userContent[0].text || "Hello"));
    } else {
      const content: MessageContent[] = userContent.map((item) => {
        if (item.type === "text") {
          return { type: "text", text: item.text || "" };
        }
        return {
          type: "image_url",
          image_url: { url: item.image_url?.url || "" }
        };
      });
      langchainMessages.push(new HumanMessage({ content }));
    }

    try {
      let response = await modelWithTools.invoke(langchainMessages);

      // Handle tool calls loop
      let toolCallIteration = 0;
      const MAX_TOOL_ITERATIONS = 20;

      while (response.tool_calls && response.tool_calls.length > 0) {
        toolCallIteration++;

        if (toolCallIteration > MAX_TOOL_ITERATIONS) {
          logger.error("tool call loop exceeded maximum iterations", {
            agent: agent.name,
            iterations: toolCallIteration,
            messageCount: langchainMessages.length
          });
          throw new Error(
            `Tool call loop exceeded maximum iterations (${MAX_TOOL_ITERATIONS}). This may indicate an infinite loop.`
          );
        }

        logger.verbose("tool calls detected", {
          agent: agent.name,
          tools: response.tool_calls.map((tc: { name: string }) => tc.name)
        });

        // Add assistant message with tool calls
        langchainMessages.push(response);

        // Execute all tool calls
        const toolMessages: ToolMessage[] = [];

        for (const toolCall of response.tool_calls) {
          const toolName = toolCall.name;
          const toolArgs = toolCall.args as Record<string, unknown>;

          logger.verbose("executing tool", { agent: agent.name, tool: toolName, args: toolArgs });

          const result = await toolExecutor(toolName, toolArgs, context);

          logger.verbose("tool executed", {
            agent: agent.name,
            tool: toolName,
            success: result.success
          });

          // Truncate large results
          const truncatedResult = truncateToolResult(result);

          toolMessages.push(
            new ToolMessage({
              content: JSON.stringify(truncatedResult),
              tool_call_id: toolCall.id || "",
              name: toolName
            })
          );
        }

        // Add tool results
        langchainMessages.push(...toolMessages);

        // Get next response
        response = await modelWithTools.invoke(langchainMessages);
      }

      // Get final text response
      const finalResponse =
        typeof response.content === "string"
          ? response.content
          : Array.isArray(response.content)
            ? (response.content as Array<{ type: string; text?: string }>)
                .filter((c): c is { type: "text"; text: string } => c.type === "text")
                .map((c) => c.text)
                .join("")
            : "";

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
