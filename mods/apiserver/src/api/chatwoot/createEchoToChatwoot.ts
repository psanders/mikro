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

/** One bot reply that was already delivered to WhatsApp. */
export interface ChatwootEcho {
  /** The customer's number as WhatsApp reports it ("18298717987" or "+18298717987"). */
  phone: string;
  content: string;
  /** The wamid Meta returned for the send. Required: see the file header. */
  sourceId: string | undefined;
}

export interface EchoToChatwootDeps {
  url: string;
  accountId: number;
  inboxId: number;
  apiToken: string;
  /** Injected so tests never reach the network. */
  fetchFn?: typeof fetch;
  /** Injected so tests don't wait between lookup attempts. */
  sleep?: (ms: number) => Promise<void>;
  /** Lookup attempts before giving up; see `findConversationId`. */
  attempts?: number;
  retryDelayMs?: number;
}

interface ChatwootContact {
  id: number;
  phone_number?: string | null;
}

interface ChatwootConversation {
  id: number;
  inbox_id: number;
  status: string;
  last_activity_at?: number;
}

const digitsOf = (phone: string) => phone.replace(/\D/g, "");

/**
 * Creates a function that posts one delivered bot reply into the customer's
 * Chatwoot conversation.
 *
 * Never throws: Chatwoot is a viewing aid and must not be able to break the bot.
 * Returns whether the message was posted so callers and tests can assert on it.
 */
export function createEchoToChatwoot(deps: EchoToChatwootDeps) {
  const { accountId, inboxId, apiToken } = deps;
  const baseUrl = deps.url.replace(/\/+$/, "");
  const fetchFn = deps.fetchFn ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const attempts = deps.attempts ?? 4;
  const retryDelayMs = deps.retryDelayMs ?? 2000;
  const api = `${baseUrl}/api/v1/accounts/${accountId}`;

  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetchFn(`${api}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", api_access_token: apiToken }
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `chatwoot ${init?.method ?? "GET"} ${path} → ${res.status} ${body.slice(0, 300)}`
      );
    }
    return (await res.json()) as T;
  }

  /**
   * The contact's most recently active non-resolved conversation in the
   * WhatsApp inbox. Retried because the bot can answer before Chatwoot has
   * finished creating the contact/conversation from the inbound webhook.
   */
  async function findConversationId(phone: string): Promise<number | null> {
    const digits = digitsOf(phone);
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const { payload: contacts } = await call<{ payload: ChatwootContact[] }>(
        `/contacts/search?q=${encodeURIComponent(digits)}`
      );
      // Search is a substring match; insist on the exact number.
      const contact = contacts.find((c) => c.phone_number && digitsOf(c.phone_number) === digits);
      if (contact) {
        const { payload: conversations } = await call<{ payload: ChatwootConversation[] }>(
          `/contacts/${contact.id}/conversations`
        );
        const open = conversations
          .filter((c) => c.inbox_id === inboxId && c.status !== "resolved")
          .sort((a, b) => (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0) || b.id - a.id);
        if (open[0]) return open[0].id;
      }
      if (attempt < attempts) await sleep(retryDelayMs);
    }
    return null;
  }

  return async (echo: ChatwootEcho): Promise<boolean> => {
    // Unconfigured is the normal local/dev state, not an error.
    if (!baseUrl || !accountId || !inboxId || !apiToken) return false;

    if (!echo.sourceId) {
      logger.warn("chatwoot echo: send has no wamid, skipping so Chatwoot won't re-send it", {
        phone: echo.phone
      });
      return false;
    }
    if (!echo.content.trim()) return false;

    try {
      const conversationId = await findConversationId(echo.phone);
      if (conversationId == null) {
        logger.warn("chatwoot echo: no open conversation for contact", { phone: echo.phone });
        return false;
      }

      await call(`/conversations/${conversationId}/messages`, {
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
