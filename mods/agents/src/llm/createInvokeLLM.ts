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
 * Tools that are known to be slow (I/O-heavy, external APIs, report generation).
 * When any of these appear in a tool-call batch we send a quick ack first.
 */
const SLOW_TOOLS = new Set([
  "createPayment",
  "sendReceiptViaWhatsApp",
  "exportAllCustomers",
  "generatePerformanceReport",
  "exportCollectorCustomers"
]);

/**
 * Result of invoking the LLM (text response and tools executed this turn).
 */
export interface InvokeLLMResult {
  text: string;
  toolsExecuted: Array<{ name: string; args: Record<string, unknown> }>;
}

/**
 * Options for createInvokeLLM.
 */
export interface InvokeLLMOptions {
  /**
   * Optional callback fired once per invocation, right before the first
   * batch of tool calls that contains at least one slow tool.
   * Intended for sending a quick generic acknowledgment to the user
   * (e.g. "Claro que sí, un momento.") without involving the LLM.
   */
  sendQuickAck?: (context: Record<string, unknown>) => Promise<void>;
}

/**
 * Format executed tools as a compact summary string.
 * Example: createPayment(loanId=10019, amount=650), sendReceiptViaWhatsApp(paymentId=pay-1)
 */
function formatToolList(
  toolsExecuted: Array<{ name: string; args: Record<string, unknown> }>
): string {
  return toolsExecuted
    .map((t) => {
      const argStr = Object.entries(t.args)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(", ");
      return argStr ? `${t.name}(${argStr})` : t.name;
    })
    .join(", ");
}

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
 * Convert a single internal Message to a LangChain BaseMessage.
 * Tool execution annotations are NOT embedded in AI messages here —
 * they are injected into the following user message by convertAllToLangChainMessages.
 */
function convertSingleMessage(msg: Message): BaseMessage {
  if (msg.role === "system") {
    return new SystemMessage(typeof msg.content === "string" ? msg.content : "");
  }

  if (msg.role === "user") {
    if (typeof msg.content === "string") {
      return new HumanMessage(msg.content || "[Message]");
    }
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
    const textContent = typeof msg.content === "string" ? msg.content : "";
    const aiMsg = new AIMessage(textContent);
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
 * Convert a list of internal Messages to LangChain BaseMessages.
 *
 * Tool execution annotations are prepended to the FOLLOWING user message
 * (not appended to the AI message) so the model never sees the annotation
 * as part of its own output and cannot learn to mimic it textually.
 */
function convertAllToLangChainMessages(messages: Message[]): BaseMessage[] {
  const result: BaseMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.role === "user") {
      const prev = i > 0 ? messages[i - 1] : null;
      const toolNote =
        prev?.role === "assistant" && prev.tools_executed?.length
          ? `[SISTEMA: Herramientas ejecutadas en respuesta anterior: ${formatToolList(prev.tools_executed)}]\n`
          : "";

      if (typeof msg.content === "string") {
        result.push(new HumanMessage(toolNote + (msg.content || "[Message]")));
      } else {
        const textBlocks: MessageContent[] = toolNote ? [{ type: "text", text: toolNote }] : [];
        const contentBlocks: MessageContent[] = msg.content.map((item) => {
          if (item.type === "text") {
            return { type: "text", text: item.text || "" };
          }
          return {
            type: "image_url",
            image_url: { url: item.image_url?.url || "" }
          };
        });
        result.push(new HumanMessage({ content: [...textBlocks, ...contentBlocks] }));
      }
      continue;
    }

    result.push(convertSingleMessage(msg));
  }

  return result;
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
 * @param options - Optional settings (e.g. sendQuickAck callback)
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
  toolExecutor: ToolExecutor,
  options?: InvokeLLMOptions
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
   * @returns The assistant's text response and list of tools executed this turn
   */
  return async function invokeLLM(
    messages: Message[],
    userMessage: string,
    imageUrl?: string | null,
    context?: Record<string, unknown>,
    isNewSession: boolean = true
  ): Promise<InvokeLLMResult> {
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

    // Build system message with session directive and user context
    const userName = context?.name ? String(context.name) : "";
    const userContext = userName ? `Nombre del usuario: ${userName}\n` : "";
    const sessionDirective = isNewSession
      ? `[NUEVA SESIÓN - Si el usuario te saluda, preséntate brevemente. En todos los casos procesa su solicitud y usa las herramientas cuando corresponda; nunca respondas solo "¡Listo!" sin haber ejecutado la herramienta.]\n${userContext}\n`
      : `[SESIÓN ACTIVA - NO te presentes, continúa la conversación directamente]\n${userContext}\n`;
    const systemContent = sessionDirective + agent.systemPrompt;

    // Convert existing messages to LangChain format
    const langchainMessages: BaseMessage[] = [
      new SystemMessage(systemContent),
      ...convertAllToLangChainMessages(messages)
    ];

    // If the last history message is an assistant with tools_executed,
    // prepend context note to the current user message so the model
    // knows what was done previously without embedding it in AI output.
    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    const toolPrefix =
      lastMsg?.role === "assistant" && lastMsg.tools_executed?.length
        ? `[SISTEMA: Herramientas ejecutadas en respuesta anterior: ${formatToolList(lastMsg.tools_executed)}]\n`
        : "";

    // Build current user message content
    const userContent: MessageContentItem[] = [];

    if (userMessage) {
      userContent.push({ type: "text", text: toolPrefix + userMessage });
    }

    if (hasImage) {
      userContent.push({
        type: "image_url",
        image_url: { url: imageUrl }
      });
    }

    if (userContent.length === 0) {
      userContent.push({ type: "text", text: toolPrefix + "Hello" });
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

    const toolsExecuted: Array<{ name: string; args: Record<string, unknown> }> = [];

    function getTextFromContent(content: unknown): string {
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return (content as Array<{ type: string; text?: string }>)
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join("");
      }
      return "";
    }

    try {
      let response = await modelWithTools.invoke(langchainMessages);

      // When the model returns text + tool_calls in the same turn, we keep that text as the
      // user-facing response. The follow-up turn after tool execution often only says goodbye
      // or is empty; using it would drop the intended closing phrase (e.g. "Queda anotada...").
      let textFromTurnWithToolCall = "";

      // Handle tool calls loop
      let toolCallIteration = 0;
      const MAX_TOOL_ITERATIONS = 20;
      let quickAckSent = false;

      while (response.tool_calls && response.tool_calls.length > 0) {
        toolCallIteration++;

        const contentFromThisTurn = getTextFromContent(response.content);
        if (contentFromThisTurn.trim()) textFromTurnWithToolCall = contentFromThisTurn;

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

        const toolNames = response.tool_calls.map((tc: { name: string }) => tc.name);

        logger.verbose("tool calls detected", {
          agent: agent.name,
          tools: toolNames
        });

        // Send a quick ack before the first batch that contains a slow tool
        if (
          !quickAckSent &&
          options?.sendQuickAck &&
          toolNames.some((name: string) => SLOW_TOOLS.has(name))
        ) {
          try {
            await options.sendQuickAck(context ?? {});
            quickAckSent = true;
            logger.verbose("quick ack sent before slow tool execution", {
              agent: agent.name,
              slowTools: toolNames.filter((n: string) => SLOW_TOOLS.has(n))
            });
          } catch (ackError) {
            const err = ackError as Error;
            logger.warn("failed to send quick ack, continuing with tool execution", {
              agent: agent.name,
              error: err.message
            });
          }
        }

        // Add assistant message with tool calls
        langchainMessages.push(response);

        // Execute all tool calls
        const toolMessages: ToolMessage[] = [];

        for (const toolCall of response.tool_calls) {
          const toolName = toolCall.name;
          const toolArgs = toolCall.args as Record<string, unknown>;

          toolsExecuted.push({ name: toolName, args: toolArgs });

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

      // Prefer text from the turn that had tool calls (e.g. full closing phrase + hangup);
      // the follow-up turn after tool execution is often just goodbye or empty.
      const finalResponse = textFromTurnWithToolCall.trim() || getTextFromContent(response.content);

      logger.verbose("llm response received", {
        agent: agent.name,
        responseLength: finalResponse.length,
        toolsExecutedCount: toolsExecuted.length
      });

      return { text: finalResponse, toolsExecuted };
    } catch (error) {
      const err = error as Error;
      logger.error("llm invocation failed", { agent: agent.name, error: err.message });
      throw error;
    }
  };
}
