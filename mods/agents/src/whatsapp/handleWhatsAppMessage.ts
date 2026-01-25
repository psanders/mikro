/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  whatsappWebhookSchema,
  type WhatsAppWebhookBody,
  type WhatsAppMessage,
  type SendWhatsAppMessageInput
} from "@mikro/common";
import type { Agent, Message } from "../llm/types.js";
import type { RouteResult } from "../router/types.js";
import { getGuestConversation, addGuestMessage } from "../conversations/inMemoryStore.js";
import { logger } from "../logger.js";

/**
 * Result of handling a WhatsApp webhook.
 */
export interface HandleWhatsAppMessageResult {
  messagesProcessed: number;
  /** Phone numbers that sent messages (useful for sending responses) */
  senders: string[];
}

/**
 * Dependencies for message processing.
 */
export interface MessageProcessorDependencies {
  /** Route a phone number to determine which agent/handler to use */
  routeMessage: (phone: string) => Promise<RouteResult>;
  /** Invoke the LLM with messages */
  invokeLLM: (
    agent: Agent,
    messages: Message[],
    userMessage: string,
    imageUrl?: string | null,
    context?: Record<string, unknown>
  ) => Promise<string>;
  /** Send a WhatsApp message (text or image) */
  sendWhatsAppMessage: (
    params: SendWhatsAppMessageInput
  ) => Promise<{ messages?: Array<{ id: string }> }>;
  /** Download media from WhatsApp to get base64 data URL */
  downloadMedia: (mediaId: string) => Promise<string>;
  /** Get chat history from database for a user */
  getChatHistoryForUser: (userId: string) => Promise<Message[]>;
  /** Add message to database for a user */
  addMessageForUser: (params: {
    userId: string;
    role: "AI" | "HUMAN";
    content: string;
  }) => Promise<void>;
  /** Get agent by name */
  getAgent: (name: "joan" | "juan" | "maria") => Agent;
}

// Global message processor (set by apiserver during initialization)
let messageProcessor: MessageProcessorDependencies | null = null;

// Track processor state for debugging
let processorSetTimestamp: number | null = null;
let initializationComplete = false;

/**
 * Get the current message processor state (for debugging).
 * @returns The current processor state
 */
export function getMessageProcessorState(): {
  exists: boolean;
  timestamp: number | null;
  initializationComplete: boolean;
} {
  return {
    exists: !!messageProcessor,
    timestamp: processorSetTimestamp,
    initializationComplete
  };
}

/**
 * Mark initialization as complete (called after processor is verified).
 */
export function markInitializationComplete(): void {
  initializationComplete = true;
  logger.info("initialization marked as complete");
}

/**
 * Set the message processor dependencies.
 * Called by the apiserver during initialization.
 *
 * @param processor - The message processor dependencies
 */
export function setMessageProcessor(processor: MessageProcessorDependencies): void {
  const beforeState = { processorExists: !!messageProcessor, timestamp: processorSetTimestamp };
  logger.info("setMessageProcessor called", {
    beforeState,
    hasRouteMessage: !!processor.routeMessage,
    hasInvokeLLM: !!processor.invokeLLM,
    hasSendWhatsAppMessage: !!processor.sendWhatsAppMessage
  });

  // Validate processor has all required functions
  if (
    !processor.routeMessage ||
    !processor.invokeLLM ||
    !processor.sendWhatsAppMessage ||
    !processor.downloadMedia ||
    !processor.getChatHistoryForUser ||
    !processor.addMessageForUser ||
    !processor.getAgent
  ) {
    const missing = [];
    if (!processor.routeMessage) missing.push("routeMessage");
    if (!processor.invokeLLM) missing.push("invokeLLM");
    if (!processor.sendWhatsAppMessage) missing.push("sendWhatsAppMessage");
    if (!processor.downloadMedia) missing.push("downloadMedia");
    if (!processor.getChatHistoryForUser) missing.push("getChatHistoryForUser");
    if (!processor.addMessageForUser) missing.push("addMessageForUser");
    if (!processor.getAgent) missing.push("getAgent");
    logger.error("setMessageProcessor called with missing dependencies", { missing });
    throw new Error(`Message processor missing required dependencies: ${missing.join(", ")}`);
  }

  messageProcessor = processor;
  processorSetTimestamp = Date.now();

  // Verify it was set
  if (!messageProcessor) {
    logger.error("messageProcessor is null after assignment - this should never happen");
    throw new Error("Failed to set message processor");
  }

  logger.verbose("message processor configured");
  const afterState = {
    processorExists: !!messageProcessor,
    timestamp: processorSetTimestamp,
    initializationComplete
  };
  logger.info("setMessageProcessor completed", { afterState, processorSet: !!messageProcessor });
}

/**
 * Handle incoming WhatsApp webhook messages.
 *
 * This function validates and processes incoming WhatsApp webhook payloads.
 * Uses the configured message processor to route and respond to messages.
 *
 * @param body - The raw webhook body from WhatsApp
 * @returns Result indicating number of messages processed and sender phone numbers
 * @throws {ValidationError} When the webhook payload is invalid
 *
 * @example
 * ```typescript
 * import { handleWhatsAppMessage, setMessageProcessor } from "@mikro/agents";
 * import { ValidationError } from "@mikro/common";
 *
 * // Configure the message processor during initialization
 * setMessageProcessor({
 *   routeMessage: createMessageRouter(deps),
 *   invokeLLM: createInvokeLLM(agent, tools, toolExecutor),
 *   sendWhatsAppMessage: createSendWhatsAppMessage(client),
 *   // ... other dependencies
 * });
 *
 * app.post('/webhook', async (req, res) => {
 *   try {
 *     const result = await handleWhatsAppMessage(req.body);
 *     console.log(`Processed ${result.messagesProcessed} messages`);
 *     res.status(200).send('OK');
 *   } catch (error) {
 *     if (error instanceof ValidationError) {
 *       console.error("Invalid webhook payload:", error.message);
 *     }
 *     res.status(200).send('OK'); // Always return 200 to WhatsApp
 *   }
 * });
 * ```
 */
export const handleWhatsAppMessage = (() => {
  const fn = async (webhookBody: WhatsAppWebhookBody): Promise<HandleWhatsAppMessageResult> => {
    // Only process whatsapp_business_account events
    if (webhookBody.object !== "whatsapp_business_account") {
      logger.verbose("ignoring non-whatsapp_business_account event", {
        object: webhookBody.object
      });
      return { messagesProcessed: 0, senders: [] };
    }

    let messagesProcessed = 0;
    const senders: string[] = [];
    const entries = webhookBody.entry ?? [];

    for (const entry of entries) {
      const changes = entry.changes ?? [];

      for (const change of changes) {
        const messages = change.value?.messages ?? [];

        for (const message of messages) {
          await processMessage(message);
          messagesProcessed++;
          if (!senders.includes(message.from)) {
            senders.push(message.from);
          }
        }
      }
    }

    logger.verbose("whatsapp webhook processed", { messagesProcessed, senders: senders.length });
    return { messagesProcessed, senders };
  };

  return withErrorHandlingAndValidation(fn, whatsappWebhookSchema);
})();

/**
 * Process a single WhatsApp message.
 *
 * 1. Routes the message based on phone number
 * 2. Gets chat history (in-memory for guests, DB for users)
 * 3. Invokes the appropriate agent's LLM
 * 4. Saves messages to history
 * 5. Sends response via WhatsApp
 *
 * @param message - The WhatsApp message to process
 */
async function processMessage(message: WhatsAppMessage): Promise<void> {
  const { from: phone, type, id, text, image } = message;

  logger.verbose("incoming whatsapp message", {
    messageId: id,
    phone,
    type,
    text: text?.body,
    imageId: image?.id,
    imageCaption: image?.caption
  });

  // Check if message processor is configured
  const processorState = {
    exists: !!messageProcessor,
    setTimestamp: processorSetTimestamp,
    timeSinceSet: processorSetTimestamp ? Date.now() - processorSetTimestamp : null,
    initializationComplete,
    hasRouteMessage: !!messageProcessor?.routeMessage,
    hasInvokeLLM: !!messageProcessor?.invokeLLM
  };
  logger.info("checking message processor", { phone, processorState });
  if (!messageProcessor || !initializationComplete) {
    logger.warn(
      "message processor not configured or initialization not complete, message will not be processed",
      {
        phone,
        processorState,
        processorExists: !!messageProcessor,
        initializationComplete
      }
    );
    return;
  }

  const {
    routeMessage,
    invokeLLM,
    sendWhatsAppMessage,
    downloadMedia,
    getChatHistoryForUser,
    addMessageForUser,
    getAgent
  } = messageProcessor;

  try {
    // Step 1: Route the message
    const route = await routeMessage(phone);

    // Step 2: Handle based on route type
    if (route.type === "member") {
      // Members don't interact with agents
      logger.verbose("no handler available for members", { phone, memberId: route.memberId });
      return;
    }

    if (route.type === "ignored") {
      logger.verbose("message ignored", { phone, reason: route.reason });
      return;
    }

    // Get message content
    const userMessage = text?.body ?? image?.caption ?? "";
    let imageUrl: string | null = null;

    // Download image if present
    if (image?.id) {
      try {
        imageUrl = await downloadMedia(image.id);
        logger.verbose("image downloaded", { phone, mediaId: image.id });
      } catch (error) {
        const err = error as Error;
        logger.error("failed to download image", { phone, mediaId: image.id, error: err.message });
      }
    }

    let agent: Agent;
    let chatHistory: Message[];
    let context: Record<string, unknown>;

    if (route.type === "guest") {
      // Guest: use Joan agent, in-memory chat history
      agent = getAgent("joan");
      chatHistory = getGuestConversation(phone);
      context = { phone };

      // Add user message to in-memory history
      addGuestMessage(phone, {
        role: "user",
        content: imageUrl
          ? [
              { type: "text", text: userMessage },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          : userMessage
      });
    } else {
      // User: route to appropriate agent based on role
      agent = route.role === "ADMIN" ? getAgent("maria") : getAgent("juan");
      chatHistory = await getChatHistoryForUser(route.userId);
      context = { userId: route.userId, phone };

      // Add user message to DB
      await addMessageForUser({
        userId: route.userId,
        role: "HUMAN",
        content: userMessage || "[Image]"
      });
    }

    // Step 3: Invoke the LLM
    const response = await invokeLLM(agent, chatHistory, userMessage, imageUrl, context);

    // Step 4: Save AI response to history
    if (route.type === "guest") {
      addGuestMessage(phone, {
        role: "assistant",
        content: response
      });
    } else {
      await addMessageForUser({
        userId: route.userId,
        role: "AI",
        content: response
      });
    }

    // Step 5: Send response via WhatsApp
    if (response) {
      await sendWhatsAppMessage({
        phone,
        message: response
      });
      logger.verbose("response sent", { phone, responseLength: response.length });
    }
  } catch (error) {
    const err = error as Error;
    logger.error("failed to process message", { phone, error: err.message });

    // Try to send an error message to the user
    try {
      await messageProcessor.sendWhatsAppMessage({
        phone,
        message:
          "Lo siento, hubo un error procesando tu mensaje. Por favor, intenta de nuevo más tarde."
      });
    } catch {
      logger.error("failed to send error message", { phone });
    }
  }
}
