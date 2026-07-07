/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  whatsappWebhookSchema,
  type WhatsAppWebhookBody,
  type WhatsAppMessage,
  type WhatsAppStatus,
  type SendWhatsAppMessageInput,
  type SendWhatsAppTemplateInput,
  type WhatsAppSendResponse
} from "@mikro/common";
import type { Agent, Message } from "../llm/types.js";
import type { InvokeLLMResult } from "../llm/createInvokeLLM.js";
import type { RouteResult } from "../router/types.js";
import { isNewSession, touchSession } from "../sessions/index.js";
import { getMessageMaxAgeSeconds } from "../config.js";
import { logger } from "../logger.js";
import type { Profile } from "../constants.js";
import { getGuestConversation, addGuestMessage } from "../conversations/index.js";
import {
  mapFlowAnswersToPayload,
  INTAKE_RECEIVED_MESSAGE
} from "./loanApplicationFlowSubmission.js";
import { handleProspectMessage } from "./handleProspectMessage.js";

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
    context?: Record<string, unknown>,
    isNewSession?: boolean
  ) => Promise<InvokeLLMResult>;
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
    tools?: string[];
  }) => Promise<void>;
  /** Resolve the agent assigned to a profile (undefined when none is assigned). */
  getAgentForProfile: (profile: Profile) => Agent | undefined;
  /** Send an approved WhatsApp template message (used by the collector promo flow). */
  sendTemplateMessage: (params: SendWhatsAppTemplateInput) => Promise<WhatsAppSendResponse>;
  /** Optional: transcribe voice note (audio data URL) to text. When set, voice notes are processed as text. */
  transcribeVoiceNote?: (audioDataUrl: string) => Promise<string>;
  /**
   * Optional: persist a prospect loan application submitted via the intake Flow.
   * Receives the website-shaped intake payload (English keys, phone injected).
   * When unset, Flow submissions are ignored.
   */
  submitApplicationFromFlow?: (payload: Record<string, string | boolean>) => Promise<void>;
  /**
   * Optional: apply an async delivery-status update (from the `statuses` webhook)
   * to the tracked outbound message. When unset, statuses are ignored.
   */
  updateOutboundStatus?: (status: WhatsAppStatus) => Promise<void>;
}

// Global message processor (set by apiserver during initialization)
let messageProcessor: MessageProcessorDependencies | null = null;

// Track processor state for debugging
let processorSetTimestamp: number | null = null;
let initializationComplete = false;

/** Deduplicate webhook delivery: message id -> timestamp (ms). Pruned by TTL. */
const processedMessageIds = new Map<string, number>();
const DEDUP_TTL_MS = 60_000;

function pruneProcessedMessageIds(): void {
  const now = Date.now();
  for (const [msgId, ts] of processedMessageIds) {
    if (now - ts > DEDUP_TTL_MS) processedMessageIds.delete(msgId);
  }
}

function isDuplicateMessage(id: string): boolean {
  pruneProcessedMessageIds();
  return processedMessageIds.has(id);
}

function markMessageProcessed(id: string): void {
  pruneProcessedMessageIds();
  processedMessageIds.set(id, Date.now());
}

/**
 * Clear processed message IDs (for testing only).
 * Ensures dedup state from previous tests doesn't affect the current test.
 */
export function resetProcessedMessageIdsForTesting(): void {
  processedMessageIds.clear();
}

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
    !processor.getAgentForProfile ||
    !processor.sendTemplateMessage
  ) {
    const missing = [];
    if (!processor.routeMessage) missing.push("routeMessage");
    if (!processor.invokeLLM) missing.push("invokeLLM");
    if (!processor.sendWhatsAppMessage) missing.push("sendWhatsAppMessage");
    if (!processor.downloadMedia) missing.push("downloadMedia");
    if (!processor.getChatHistoryForUser) missing.push("getChatHistoryForUser");
    if (!processor.addMessageForUser) missing.push("addMessageForUser");
    if (!processor.getAgentForProfile) missing.push("getAgentForProfile");
    if (!processor.sendTemplateMessage) missing.push("sendTemplateMessage");
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

        // Async delivery receipts for our outbound sends (sent/delivered/read/
        // failed). Separate from inbound `messages` — a delivery does not count
        // as a processed message or a sender.
        const statuses = change.value?.statuses ?? [];
        for (const status of statuses) {
          await processStatusUpdate(status);
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
  const { from: phone, type, id, text, image, audio, timestamp } = message;

  const messageAgeSeconds = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  const maxAgeSeconds = getMessageMaxAgeSeconds();

  if (messageAgeSeconds > maxAgeSeconds) {
    logger.verbose("discarding old message", {
      messageId: id,
      phone,
      messageAgeSeconds,
      maxAgeSeconds
    });
    return;
  }

  if (isDuplicateMessage(id)) {
    logger.verbose("skipping duplicate message", { messageId: id, phone });
    return;
  }
  markMessageProcessed(id);

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
    getAgentForProfile,
    transcribeVoiceNote,
    submitApplicationFromFlow
  } = messageProcessor;

  // Intake Flow submission: a completed solicitud arrives as an interactive
  // nfm_reply with the answers as a JSON string. Ingest it (no routing/LLM) and
  // confirm. Handled before routing because the submitter is still an unknown
  // prospect — there is no agent conversation to run.
  if (type === "interactive" && message.interactive?.nfm_reply) {
    await processIntakeFlowSubmission(
      message,
      phone,
      sendWhatsAppMessage,
      submitApplicationFromFlow
    );
    return;
  }

  // Start routing early so it runs in parallel with media download/transcription
  const routePromise = routeMessage(phone);

  // Voice notes (audio): require optional transcriber; otherwise tell user not available
  const VOICE_NOT_AVAILABLE_MSG =
    "No puedo escuchar notas de voz. Por favor, escríbeme un mensaje de texto.";
  const VOICE_ERROR_MSG = "No pude entender el audio. Intenta de nuevo o escribe un mensaje.";

  let userMessage: string = "";
  let imageUrl: string | null = null;

  if (type === "audio") {
    if (!transcribeVoiceNote) {
      logger.verbose("voice note received, sending not available message", {
        phone,
        messageId: id
      });
      try {
        await sendWhatsAppMessage({ phone, message: VOICE_NOT_AVAILABLE_MSG });
      } catch (error) {
        const err = error as Error;
        logger.error("failed to send voice note not available message", {
          phone,
          error: err.message
        });
      }
      return;
    }
    if (!audio?.id) {
      logger.warn("voice note missing audio id", { phone, messageId: id });
      try {
        await sendWhatsAppMessage({ phone, message: VOICE_ERROR_MSG });
      } catch {
        // ignore
      }
      return;
    }
    try {
      const dataUrl = await downloadMedia(audio.id);
      logger.verbose("voice note downloaded", { phone, mediaId: audio.id });
      const transcribed = await transcribeVoiceNote(dataUrl);
      userMessage = "[Voice]: " + transcribed;
    } catch (error) {
      const err = error as Error;
      logger.error("voice note download or transcription failed", {
        phone,
        messageId: id,
        error: err.message
      });
      try {
        await sendWhatsAppMessage({ phone, message: VOICE_ERROR_MSG });
      } catch {
        // ignore
      }
      return;
    }
  }

  try {
    let route: RouteResult;

    if (type !== "audio") {
      userMessage = text?.body ?? image?.caption ?? "";

      // Download image and route in parallel when image is present
      if (image?.id) {
        const [imgResult, routeResult] = await Promise.allSettled([
          downloadMedia(image.id),
          routePromise
        ]);
        if (imgResult.status === "fulfilled") {
          imageUrl = imgResult.value;
          logger.verbose("image downloaded", { phone, mediaId: image.id });
        } else {
          const err = (imgResult as PromiseRejectedResult).reason as Error;
          logger.error("failed to download image", {
            phone,
            mediaId: image.id,
            error: err.message
          });
        }
        if (routeResult.status === "rejected") throw routeResult.reason;
        route = routeResult.value;
      } else {
        route = await routePromise;
      }
    } else {
      route = await routePromise;
    }

    // Step 2: Handle based on route type
    if (route.type === "customer") {
      // Customers don't interact with agents
      logger.verbose("no handler available for customers", { phone, customerId: route.customerId });
      return;
    }

    if (route.type === "ignored") {
      logger.verbose("message ignored", { phone, reason: route.reason });
      return;
    }

    // Guest: unknown phone, no application. Respond only if a GUEST agent is
    // assigned in config; otherwise ignore (preserves the no-auto-reply default).
    if (route.type === "guest") {
      const guestAgent = getAgentForProfile("GUEST");
      if (!guestAgent) {
        logger.verbose("no agent assigned to GUEST profile, ignoring", { phone });
        return;
      }
      const history = getGuestConversation(phone);
      const newGuestSession = isNewSession(phone);
      const guestResult = await invokeLLM(
        guestAgent,
        history,
        userMessage,
        imageUrl,
        { phone },
        newGuestSession
      );
      touchSession(phone);
      const guestText = typeof guestResult === "string" ? guestResult : guestResult.text;
      addGuestMessage(phone, { role: "user", content: userMessage });
      addGuestMessage(phone, { role: "assistant", content: guestText });
      if (guestText) await sendWhatsAppMessage({ phone, message: guestText });
      return;
    }

    // Prospect: partial application → PROSPECT agent (José); completed → hold message.
    if (route.type === "prospect") {
      if (!route.partial) {
        logger.verbose("prospect application already complete, sending hold message", { phone });
        await sendWhatsAppMessage({
          phone,
          message: "Tu solicitud ya está en revisión. Pronto te contactaremos."
        });
        return;
      }
      const prospectAgent = getAgentForProfile("PROSPECT");
      if (!prospectAgent) {
        logger.verbose("no agent assigned to PROSPECT profile, ignoring prospect message", {
          phone
        });
        return;
      }
      const result = await handleProspectMessage(phone, route.sessionId, userMessage, {
        invokeLLM,
        joseAgent: prospectAgent
      });
      if (result.text) {
        await sendWhatsAppMessage({ phone, message: result.text });
      }
      return;
    }

    // COLLECTOR: the photo → vision → WhatsApp-button promo flow was retired
    // in favor of a native mobile action (mods/mobile app/promocionar.tsx,
    // mikro/#68) — no photo capture, no computer-vision extraction step. A
    // COLLECTOR profile can still be assigned an LLM agent in agents.yaml for
    // other purposes, so fall through to the generic agent path below rather
    // than special-casing the role; only reply here when nothing is assigned,
    // so collectors who still text a photo out of habit get redirected
    // instead of silence.
    if (route.role === "COLLECTOR" && !getAgentForProfile("COLLECTOR")) {
      await sendWhatsAppMessage({
        phone,
        message: "Ahora puedes enviar promociones directamente desde la app Mikro Cobradores."
      });
      return;
    }

    // Known users with an LLM agent (e.g. ADMIN → María).
    const agent = getAgentForProfile(route.role);
    if (!agent) {
      logger.verbose("no agent assigned to user role profile", { phone, role: route.role });
      return;
    }
    const chatHistory: Message[] = await getChatHistoryForUser(route.userId);
    const context: Record<string, unknown> = {
      userId: route.userId,
      name: route.name,
      phone,
      role: route.role
    };

    // Add user message to DB
    await addMessageForUser({
      userId: route.userId,
      role: "HUMAN",
      content: userMessage || "[Image]"
    });

    const sessionIdentifier = route.userId;
    const newSession = isNewSession(sessionIdentifier);

    // Step 3: Invoke the LLM
    const result = await invokeLLM(agent, chatHistory, userMessage, imageUrl, context, newSession);

    touchSession(sessionIdentifier);

    const responseText = typeof result === "string" ? result : result.text;
    const toolsExecuted = typeof result === "string" ? [] : (result.toolsExecuted ?? []);

    // Step 4 & 5: Save AI response and send via WhatsApp (in parallel).
    const savePromise = addMessageForUser({
      userId: route.userId,
      role: "AI",
      content: responseText,
      tools: toolsExecuted.length > 0 ? toolsExecuted.map((t) => t.name) : undefined
    });
    if (responseText) {
      await Promise.all([savePromise, sendWhatsAppMessage({ phone, message: responseText })]);
    } else {
      await savePromise;
    }
    if (responseText) {
      logger.verbose("response sent", {
        phone,
        responseLength: responseText.length,
        toolsExecutedCount: toolsExecuted.length
      });
    }
  } catch (error) {
    const err = error as Error;
    logger.error("failed to process message", {
      phone,
      error: err.message,
      stack: err.stack,
      cause: err.cause != null ? String(err.cause) : undefined
    });

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

/**
 * Route an async delivery-status update to the configured handler. No-op when no
 * processor / `updateOutboundStatus` is configured (statuses are ignored, as
 * before). Best-effort: failures are logged, never thrown.
 */
async function processStatusUpdate(status: WhatsAppStatus): Promise<void> {
  if (!messageProcessor?.updateOutboundStatus) return;
  try {
    await messageProcessor.updateOutboundStatus(status);
  } catch (error) {
    logger.error("failed to process delivery status", {
      waMessageId: status.id,
      status: status.status,
      error: (error as Error).message
    });
  }
}

/**
 * Ingest a completed intake Flow: parse the answers, map them to the website
 * intake payload (phone injected, redelivery-safe sessionId), persist via the
 * injected submitter, and confirm to the prospect. Failures are logged and a
 * soft error is sent so the prospect can retry.
 */
async function processIntakeFlowSubmission(
  message: WhatsAppMessage,
  phone: string,
  sendWhatsAppMessage: MessageProcessorDependencies["sendWhatsAppMessage"],
  submitApplicationFromFlow: MessageProcessorDependencies["submitApplicationFromFlow"]
): Promise<void> {
  if (!submitApplicationFromFlow) {
    logger.warn("intake flow submission received but no submitter configured", { phone });
    return;
  }

  const responseJson = message.interactive?.nfm_reply?.response_json;
  if (!responseJson) {
    logger.warn("intake flow reply missing response_json", { phone, messageId: message.id });
    return;
  }

  let answers: Record<string, unknown>;
  try {
    answers = JSON.parse(responseJson) as Record<string, unknown>;
  } catch {
    logger.error("failed to parse intake flow response_json", { phone, messageId: message.id });
    return;
  }

  // sessionId keyed on the message id: a redelivered webhook upserts the same row.
  const sessionId = `wa-${message.id}`;
  const payload = mapFlowAnswersToPayload(answers, phone, sessionId);

  try {
    await submitApplicationFromFlow(payload);
    logger.info("intake flow application submitted", { phone, sessionId });
    await sendWhatsAppMessage({ phone, message: INTAKE_RECEIVED_MESSAGE });
  } catch (error) {
    logger.error("failed to submit intake flow application", {
      phone,
      sessionId,
      error: (error as Error).message
    });
    try {
      await sendWhatsAppMessage({
        phone,
        message:
          "Hubo un problema al recibir tu solicitud. Por favor, intenta de nuevo en unos minutos."
      });
    } catch {
      logger.error("failed to send intake error message", { phone });
    }
  }
}
