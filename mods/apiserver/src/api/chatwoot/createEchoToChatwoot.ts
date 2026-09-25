/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Mirrors the bot's WhatsApp replies into Chatwoot so agents see the whole
 * conversation. Chatwoot already receives the customer's inbound messages, but
 * Meta never echoes Cloud API sends back as webhooks, so the bot's side of the
 * chat is invisible there without this.
 *
 * The echo MUST carry the WhatsApp message id as `source_id`. Chatwoot treats an
 * outgoing message with a `source_id` as one that originated from the channel
 * (`Base::SendOnChannelService#invalid_message?`) and does not deliver it. Post
 * one without it and Chatwoot sends the reply to the customer a second time —
 * so a send with no wamid is never echoed.
 */
import { logger } from "../../logger.js";
import { createChatwootClient, type ChatwootConfig } from "./chatwootClient.js";

/** One bot reply that was already delivered to WhatsApp. */
export interface ChatwootEcho {
  /** The customer's number as WhatsApp reports it ("18298717987" or "+18298717987"). */
  phone: string;
  content: string;
  /** The wamid Meta returned for the send. Required: see the file header. */
  sourceId: string | undefined;
}

export type EchoToChatwootDeps = ChatwootConfig;

/**
 * Creates a function that posts one delivered bot reply into the customer's
 * Chatwoot conversation.
 *
 * Never throws: Chatwoot is a viewing aid and must not be able to break the bot.
 * Returns whether the message was posted so callers and tests can assert on it.
 */
export function createEchoToChatwoot(deps: EchoToChatwootDeps) {
  const chatwoot = createChatwootClient(deps);

  return async (echo: ChatwootEcho): Promise<boolean> => {
    if (!chatwoot.configured) return false;
    if (!echo.sourceId) {
      logger.warn("chatwoot echo: send has no wamid, skipping so Chatwoot won't re-send it", {
        phone: echo.phone
      });
      return false;
    }
    if (!echo.content.trim()) return false;

    try {
      const conversationId = await chatwoot.findConversationId(echo.phone);
      if (conversationId == null) {
        logger.warn("chatwoot echo: no open conversation for contact", { phone: echo.phone });
        return false;
      }

      await chatwoot.call(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: echo.content,
          message_type: "outgoing",
          private: false,
          source_id: echo.sourceId
        })
      });
      logger.verbose("chatwoot echo: reply mirrored", {
        phone: echo.phone,
        conversationId,
        sourceId: echo.sourceId
      });
      return true;
    } catch (err) {
      logger.error("chatwoot echo: request failed", {
        phone: echo.phone,
        error: err instanceof Error ? err.message : String(err)
      });
      return false;
    }
  };
}
