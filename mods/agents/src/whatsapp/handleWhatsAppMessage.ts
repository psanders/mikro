/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  whatsappWebhookSchema,
  whatsappMessageSchema,
  validatePhone,
  type WhatsAppContact,
  type WhatsAppWebhookBody,
  type WhatsAppMessage,
  type WhatsAppStatus,
  type SendWhatsAppMessageInput,
  type SendWhatsAppTemplateInput,
  type WhatsAppSendResponse
} from "@mikro/common";
import type { Agent, Message } from "../llm/types.js";
import type { InvokeLLMResult } from "../llm/createInvokeLLM.js";
import type { RouteResult, SenderIdentity } from "../router/types.js";
import { isNewSession, touchSession } from "../sessions/index.js";
import { getMessageMaxAgeSeconds, getWhatsAppAgentRepliesEnabled } from "../config.js";
import { logger } from "../logger.js";
import type { Profile } from "../constants.js";
import { getGuestConversation, addGuestMessage } from "../conversations/index.js";
import {
  mapFlowAnswersToPayload,
  INTAKE_RECEIVED_MESSAGE
} from "./loanApplicationFlowSubmission.js";
import { handleProspectMessage, isDecline, getProspectHistory } from "./handleProspectMessage.js";

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
  /** Decide who is writing (phone, or BSUID for a username sender) and so which agent answers. */
  routeMessage: (sender: SenderIdentity | string) => Promise<RouteResult>;
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
  submitApplicationFromFlow?: (
    payload: Record<string, string | boolean>,
    submitter?: { whatsappUserId?: string; whatsappUsername?: string }
  ) => Promise<void>;
  /**
   * Optional: apply an async delivery-status update (from the `statuses` webhook)
   * to the tracked outbound message. When unset, statuses are ignored.
   */
  updateOutboundStatus?: (status: WhatsAppStatus) => Promise<void>;
  // ── WhatsApp CX (openspec cx-role-based-agents) — all optional ──────────
  /** Restart a DRAFT's abandon clock (the prospect wrote in). */
  recordProspectActivity?: (applicationId: string) => Promise<void>;
  /** Reopen a never-submitted ABANDONED application to DRAFT; false if not allowed. */
  reopenApplication?: (applicationId: string) => Promise<boolean>;
  /**
   * If a human hand-off is open for the phone, push its expiry out and return
   * true; agents then stay silent. False when none is open.
   */
  extendHandoff?: (key: { phone: string; whatsappUserId?: string }) => Promise<boolean>;
  /** Open a human hand-off (the explicit-request backstop). */
  openHandoff?: (input: {
    phone: string;
    profile: Profile;
    reason: string;
    applicationId?: string;
    customerId?: string;
    displayName?: string;
    /** Last turns (oldest first) for the Chatwoot note; no agent summarized. */
    recentMessages?: Array<{ role: "user" | "assistant"; content: string }>;
    /** The sender's BSUID / username when they write with a WhatsApp username. */
    whatsappUserId?: string;
    username?: string;
  }) => Promise<unknown>;
  /**
   * Record a sender's BSUID (and username) on their customer / application
   * rows when a message carries both their phone and BSUID. Best-effort.
   */
  linkWhatsAppIdentity?: (link: {
    phone: string;
    bsuid: string;
    username?: string;
  }) => Promise<void>;
  /**
   * The sender shared their own number (a contact-info request answered, e.g.
   * one sent from Chatwoot): fill it on their BSUID-linked rows and link.
   */
  recordSharedWhatsAppPhone?: (link: {
    phone: string;
    bsuid: string;
    username?: string;
  }) => Promise<void>;
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
 * Stand-in sender used when replies are disabled: swallows the send so a path
 * that must keep running (intake Flow ingestion) does not also have to know
 * about the kill switch.
 */
const silentSend: MessageProcessorDependencies["sendWhatsAppMessage"] = async (params) => {
  logger.verbose("whatsapp agent replies disabled, suppressing outbound reply", {
    phone: params.phone
  });
  return {};
};

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
        const contacts = change.value?.contacts ?? [];

        // Validated one by one: a message shape we don't know (Meta adds
        // fields and types) must never take the rest of the delivery with it.
        for (const raw of messages) {
          const parsed = whatsappMessageSchema.safeParse(raw);
          if (!parsed.success) {
            logger.warn("skipping unparseable whatsapp message", {
              issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
            });
            continue;
          }
          const message = parsed.data;
          const sender = buildSenderIdentity(message, contacts);
          if (!sender) {
            logger.warn("skipping whatsapp message with no sender", { messageId: message.id });
            continue;
          }
          await processMessage(message, sender);
          messagesProcessed++;
          if (!senders.includes(sender.address)) {
            senders.push(sender.address);
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
 * Who sent a message. Meta gives the phone in `from` (and `contacts[].wa_id`)
 * unless the sender uses a WhatsApp username and hides their number; then only
 * the business-scoped user id arrives (`from_user_id` / `contacts[].user_id`).
 * Replies and conversations are keyed by the phone when there is one, else by
 * the BSUID. Returns null when the message names no sender at all.
 */
export function buildSenderIdentity(
  message: WhatsAppMessage,
  contacts: WhatsAppContact[]
): SenderIdentity | null {
  const contact =
    contacts.find(
      (c) =>
        (message.from_user_id && c.user_id === message.from_user_id) ||
        (message.from && c.wa_id === message.from)
    ) ?? (contacts.length === 1 ? contacts[0] : undefined);
  const phone = message.from ?? contact?.wa_id;
  const bsuid = message.from_user_id ?? contact?.user_id;
  const username = contact?.profile?.username;
  const address = phone ?? bsuid;
  if (!address) return null;
  return {
    address,
    ...(phone ? { phone } : {}),
    ...(bsuid ? { bsuid } : {}),
    ...(username ? { username } : {})
  };
}

/** A WhatsApp phone ("18298717987") as stored E.164, or null if not a phone. */
function toE164(raw: string): string | null {
  if (!raw) return null;
  try {
    return validatePhone(raw);
  } catch {
    return null;
  }
}

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
 * @param sender - Who sent it (phone, or BSUID for a username sender)
 */
async function processMessage(message: WhatsAppMessage, sender: SenderIdentity): Promise<void> {
  // Where replies go: the phone, or the BSUID of a username sender.
  const phone = sender.address;
  const { type, id, text, image, audio, timestamp } = message;

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

  // Whenever Meta shows both the phone and the BSUID, remember the BSUID on
  // the sender's customer / application rows, so they still match once they
  // hide their number behind a username. Runs even with replies disabled.
  if (sender.phone && sender.bsuid && messageProcessor.linkWhatsAppIdentity) {
    const e164 = toE164(sender.phone);
    if (e164) {
      void messageProcessor
        .linkWhatsAppIdentity({ phone: e164, bsuid: sender.bsuid, username: sender.username })
        .catch((error: Error) =>
          logger.error("failed to link whatsapp identity", { phone, error: error.message })
        );
    }
  }

  // The sender shared their OWN number (answering a contact-info request, e.g.
  // one a person sent from Chatwoot). Record it and stay silent: it is not a
  // conversation turn. Other contact cards may be third parties' — not trusted.
  if (type === "contacts" && sender.bsuid) {
    const own = message.contacts?.find((c) => c.origin === "contact_request");
    const shared = own?.phones?.[0];
    const e164 = toE164(shared?.wa_id ?? shared?.phone ?? "");
    if (own && e164) {
      if (messageProcessor.recordSharedWhatsAppPhone) {
        await messageProcessor.recordSharedWhatsAppPhone({
          phone: e164,
          bsuid: sender.bsuid,
          username: sender.username
        });
      }
      logger.info("username sender shared their phone", { bsuid: sender.bsuid });
      return;
    }
  }

  // `whatsapp.agentRepliesEnabled: false` in mikro.json makes the number stop
  // answering: no LLM, and none of the deterministic fallbacks below either.
  const repliesEnabled = getWhatsAppAgentRepliesEnabled();

  // Intake Flow submission: a completed solicitud arrives as an interactive
  // nfm_reply with the answers as a JSON string. Ingest it (no routing/LLM) and
  // confirm. Handled before routing because the submitter is still an unknown
  // prospect — there is no agent conversation to run.
  //
  // Runs even with replies disabled: the solicitud is persisted either way,
  // only the confirmation is withheld. Going quiet must never cost an
  // application.
  if (type === "interactive" && message.interactive?.nfm_reply) {
    await processIntakeFlowSubmission(
      message,
      sender,
      repliesEnabled ? sendWhatsAppMessage : silentSend,
      submitApplicationFromFlow
    );
    return;
  }

  // Everything else is a conversation turn, and a turn with no reply is just
  // work we are throwing away — stop before routing and the LLM call.
  if (!repliesEnabled) {
    logger.info("whatsapp agent replies disabled, ignoring inbound message", {
      phone,
      messageId: id,
      type
    });
    // A prospect writing in is still activity: it keeps their draft from being
    // abandoned even while the number is quiet. Only route when that matters.
    if (messageProcessor.recordProspectActivity) {
      await recordActivityIfProspect(sender, messageProcessor);
    }
    return;
  }

  // Start routing early so it runs in parallel with media download/transcription
  const routePromise = routeMessage(sender);

  // Voice notes (audio): require optional transcriber; otherwise tell user not available
  const VOICE_NOT_AVAILABLE_MSG =
    "No puedo escuchar notas de voz. Por favor, escríbeme un mensaje de texto.";
  const VOICE_ERROR_MSG = "No pude entender el audio. Intenta de nuevo o escribe un mensaje.";

  let userMessage: string = "";
  let imageUrl: string | null = null;
  // A voice note we can't use. The notice waits for routing: it is still a
  // reply, so it must respect an open hand-off and the "no agent, no reply"
  // rule like any other, and the message still counts as prospect activity.
  let voiceNotice: string | null = null;

  if (type === "audio") {
    if (!transcribeVoiceNote) {
      logger.verbose("voice note received, transcription not available", {
        phone,
        messageId: id
      });
      voiceNotice = VOICE_NOT_AVAILABLE_MSG;
    } else if (!audio?.id) {
      logger.warn("voice note missing audio id", { phone, messageId: id });
      voiceNotice = VOICE_ERROR_MSG;
    } else {
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
        voiceNotice = VOICE_ERROR_MSG;
      }
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
    if (route.type === "ignored") {
      logger.verbose("message ignored", { phone, reason: route.reason });
      return;
    }

    if (voiceNotice !== null) {
      const mayReply =
        route.type === "user"
          ? !!getAgentForProfile(route.role)
          : await passesCxGate(route, messageProcessor, sender);
      if (mayReply) {
        try {
          await sendWhatsAppMessage({ phone, message: voiceNotice });
        } catch (error) {
          logger.error("failed to send voice note notice", {
            phone,
            error: (error as Error).message
          });
        }
      }
      return;
    }

    if (route.type !== "user") {
      await handleCxMessage(route, userMessage, imageUrl, messageProcessor, sender);
      return;
    }

    // Employees (ADMIN, REVIEWER, COLLECTOR) get no automated reply unless an
    // agent is explicitly assigned to their role. Their message still reaches
    // the Chatwoot inbox through the WABA fan-out, where a person sees it.
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

/** Chat routes answered by a CX agent (everything except staff). */
type CxRoute = Exclude<RouteResult, { type: "user" } | { type: "ignored" }>;

/**
 * An explicit request for a person. Kept to imperative forms so a passing
 * mention ("mi asesor me dijo…") does not silence the agent; softer cases are
 * the agent's call through `requestHumanHandoff`.
 */
const HUMAN_REQUEST_RE =
  /\b(quiero|quisiera|necesito|prefiero|puedo|me gustar[ií]a)\s+(hablar|conversar|comunicarme)\s+con\s+(una?\s+)?(persona|humano|alguien|asesor[a]?|agente|representante|empleado)\b|\b(p[aá]same|comun[ií]came|ponme)\s+con\s+(una?\s+)?(persona|humano|alguien|asesor[a]?|agente|representante)\b|\bhablar\s+con\s+un\s+humano\b/i;

export function isHumanRequest(message: string): boolean {
  return HUMAN_REQUEST_RE.test(message);
}

/**
 * Context for the guest agent when the sender's last application was rejected
 * recently: without it the agent would invite them to apply again right away.
 * No hand-off unless they ask for a person (founder decision 2026-09-26).
 */
export function rejectedDirective(reapplyFrom: Date): string {
  const date = new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Santo_Domingo"
  }).format(reapplyFrom);
  return (
    `[SISTEMA: Esta persona tuvo una solicitud que NO fue aprobada. Puede volver a ` +
    `solicitar a partir del ${date}. Si pregunta por su solicitud o por volver a ` +
    `aplicar, dile con amabilidad que su solicitud anterior no fue aprobada y que ` +
    `puede volver a solicitar a partir del ${date} en https://mikro.do/solicitud. NO ` +
    `la invites a solicitar antes de esa fecha. NO expliques motivos de la decisión. ` +
    `Si pide hablar con una persona, usa requestHumanHandoff.] `
  );
}

/** A WhatsApp username sender we couldn't match: a person takes it. */
const UNMATCHED_USERNAME_ACK =
  "Hola, gracias por escribirnos. Ya le avisé al equipo; una persona te va a responder por aquí.";

const HANDOFF_ACK =
  "Claro, ya le avisé al equipo. Una persona te va a responder por aquí lo antes posible.";

function profileFor(route: CxRoute): Profile {
  switch (route.type) {
    case "customer":
      return "CUSTOMER";
    case "applicant":
      return "APPLICANT";
    case "prospect":
    case "reopen":
      return "PROSPECT";
    case "guest":
      return "GUEST";
  }
}

/** How many turns of history the Chatwoot note shows for a deterministic hand-off. */
const NOTE_TURNS = 6;

/** The last turns of this conversation plus the message just received. */
function recentTurns(
  route: CxRoute,
  userMessage: string
): Array<{ role: "user" | "assistant"; content: string }> {
  const history =
    route.type === "prospect" || route.type === "reopen"
      ? getProspectHistory(route.phone)
      : getGuestConversation(route.phone);
  const turns = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : ""
    }));
  return [...turns, { role: "user" as const, content: userMessage }].slice(-NOTE_TURNS);
}

/** Context every CX tool reads identity from (never from model arguments). */
function cxContext(
  route: CxRoute,
  profile: Profile,
  imageUrl: string | null,
  sender?: SenderIdentity
) {
  return {
    phone: route.phone,
    profile,
    // A username sender's ids, so a hand-off from the agent can find them later.
    ...(sender?.bsuid ? { whatsappUserId: sender.bsuid } : {}),
    ...(sender?.username ? { username: sender.username } : {}),
    ...(route.type === "customer" ? { customerId: route.customerId, name: route.name } : {}),
    // A returning customer's new application, or the applicant's/prospect's own.
    ...(route.type === "customer" && route.applicationId
      ? { applicationId: route.applicationId }
      : {}),
    ...(route.type === "applicant" || route.type === "prospect" || route.type === "reopen"
      ? { applicationId: route.applicationId, sessionId: route.sessionId }
      : {}),
    ...(imageUrl ? { imageDataUrl: imageUrl } : {})
  };
}

async function recordActivityIfProspect(
  sender: SenderIdentity,
  processor: MessageProcessorDependencies
): Promise<void> {
  const phone = sender.address;
  try {
    const route = await processor.routeMessage(sender);
    if (route.type === "prospect") await processor.recordProspectActivity?.(route.applicationId);
  } catch (error) {
    logger.error("failed to record prospect activity", {
      phone,
      error: (error as Error).message
    });
  }
}

/**
 * What every inbound CX message goes through before anything may answer it:
 * record prospect activity, then stay silent if a human hand-off is open or
 * no agent serves the profile. Returns whether a reply is allowed.
 */
async function passesCxGate(
  route: CxRoute,
  processor: MessageProcessorDependencies,
  sender?: SenderIdentity
): Promise<boolean> {
  const { phone } = route;
  const profile = profileFor(route);

  if (route.type === "prospect" && processor.recordProspectActivity) {
    await processor.recordProspectActivity(route.applicationId);
  }

  if (
    processor.extendHandoff &&
    (await processor.extendHandoff({ phone, whatsappUserId: sender?.bsuid }))
  ) {
    logger.verbose("human hand-off open, agent stays silent", { phone, profile });
    return false;
  }

  if (!processor.getAgentForProfile(profile)) {
    logger.verbose("no agent assigned to profile, ignoring", { phone, profile });
    return false;
  }
  return true;
}

/**
 * Answer a guest, prospect, applicant or customer (openspec
 * cx-role-based-agents): record prospect activity, stay silent during a human
 * hand-off, honor an explicit request for a person, reopen an abandoned draft,
 * then hand the turn to the agent serving the profile (none assigned → no reply).
 */
async function handleCxMessage(
  route: CxRoute,
  userMessage: string,
  imageUrl: string | null,
  processor: MessageProcessorDependencies,
  sender?: SenderIdentity
): Promise<void> {
  const { phone } = route;
  const { invokeLLM, sendWhatsAppMessage, getAgentForProfile } = processor;
  const profile = profileFor(route);
  const senderIds = {
    ...(sender?.bsuid ? { whatsappUserId: sender.bsuid } : {}),
    ...(sender?.username ? { username: sender.username } : {})
  };

  if (!(await passesCxGate(route, processor, sender))) return;
  const agent = getAgentForProfile(profile)!;

  // A WhatsApp username sender we can't tie to any application or customer:
  // without a phone the agents can't look anything up for them, so a person
  // takes it (founder decision, openspec whatsapp-username-senders).
  if (route.type === "guest" && route.unmatchedUsername && processor.openHandoff) {
    await processor.openHandoff({
      phone,
      profile,
      reason: "Escribe con nombre de usuario, sin número",
      recentMessages: recentTurns(route, userMessage),
      ...senderIds
    });
    await sendWhatsAppMessage({ phone, message: UNMATCHED_USERNAME_ACK });
    return;
  }

  // An explicit "no me interesa" wins over a request for a person: José closes it.
  const optingOut = profile === "PROSPECT" && isDecline(userMessage);
  if (processor.openHandoff && !optingOut && isHumanRequest(userMessage)) {
    const ctx = cxContext(route, profile, null);
    await processor.openHandoff({
      phone,
      profile,
      reason: "Pidió hablar con una persona",
      applicationId: "applicationId" in ctx ? ctx.applicationId : undefined,
      customerId: "customerId" in ctx ? ctx.customerId : undefined,
      displayName: "name" in ctx ? ctx.name : undefined,
      recentMessages: recentTurns(route, userMessage),
      ...senderIds
    });
    await sendWhatsAppMessage({ phone, message: HANDOFF_ACK });
    return;
  }

  if (route.type === "reopen") {
    if (!processor.reopenApplication || !(await processor.reopenApplication(route.applicationId))) {
      logger.verbose("abandoned application not reopened, ignoring", { phone });
      return;
    }
  }

  if (route.type === "prospect" || route.type === "reopen") {
    const result = await handleProspectMessage(phone, route.sessionId, userMessage, {
      invokeLLM,
      joseAgent: agent,
      applicationId: route.applicationId
    });
    if (result.text) await sendWhatsAppMessage({ phone, message: result.text });
    return;
  }

  // GUEST, APPLICANT, CUSTOMER: phone-keyed in-memory conversation.
  const history = getGuestConversation(phone);
  const newSession = isNewSession(phone);
  // Stored history keeps the person's words; only this turn's input carries it.
  const llmInput =
    route.type === "guest" && route.reapplyFrom
      ? rejectedDirective(route.reapplyFrom) + userMessage
      : userMessage;
  const result = await invokeLLM(
    agent,
    history,
    llmInput,
    imageUrl,
    cxContext(route, profile, imageUrl, sender),
    newSession
  );
  touchSession(phone);
  const text = typeof result === "string" ? result : result.text;
  const toolsExecuted = typeof result === "string" ? [] : (result.toolsExecuted ?? []);
  addGuestMessage(phone, { role: "user", content: userMessage || "[Imagen]" });
  addGuestMessage(phone, {
    role: "assistant",
    content: text,
    tools_executed: toolsExecuted.length > 0 ? toolsExecuted : undefined
  });
  if (text) await sendWhatsAppMessage({ phone, message: text });
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
  sender: SenderIdentity,
  sendWhatsAppMessage: MessageProcessorDependencies["sendWhatsAppMessage"],
  submitApplicationFromFlow: MessageProcessorDependencies["submitApplicationFromFlow"]
): Promise<void> {
  const phone = sender.address;
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
  // The applicant's phone is the sender's; a username sender may have none, and
  // is tied to the application by their BSUID instead.
  const payload = mapFlowAnswersToPayload(answers, sender.phone, sessionId);

  try {
    await submitApplicationFromFlow(
      payload,
      sender.bsuid ? { whatsappUserId: sender.bsuid, whatsappUsername: sender.username } : {}
    );
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
