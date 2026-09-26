/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The small slice of the Chatwoot API Mikro uses: find a contact's open
 * WhatsApp conversation, post into it, and manage its labels. Shared by the
 * reply mirror (createEchoToChatwoot) and the hand-off note
 * (createNotifyChatwootHandoff).
 */
import { isBusinessScopedUserId } from "@mikro/common";

export interface ChatwootConfig {
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

/** A conversation as the list endpoint returns it (sender embedded). */
interface ChatwootListedConversation extends ChatwootConversation {
  meta?: {
    sender?: {
      id: number;
      phone_number?: string | null;
      additional_attributes?: { social_whatsapp_user_name?: string | null } | null;
    };
  };
}

/** How many pages of the inbox's recent conversations a username lookup scans. */
const USERNAME_SCAN_PAGES = 2;

const digitsOf = (phone: string) => phone.replace(/\D/g, "");

export function createChatwootClient(cfg: ChatwootConfig) {
  const { accountId, inboxId, apiToken } = cfg;
  const baseUrl = cfg.url.replace(/\/+$/, "");
  const fetchFn = cfg.fetchFn ?? fetch;
  const sleep = cfg.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const attempts = cfg.attempts ?? 4;
  const retryDelayMs = cfg.retryDelayMs ?? 2000;
  const api = `${baseUrl}/api/v1/accounts/${accountId}`;

  /** Unconfigured is the normal local/dev state, not an error. */
  const configured = !!(baseUrl && accountId && inboxId && apiToken);

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
   * WhatsApp inbox. Retried because Mikro can act before Chatwoot has finished
   * creating the contact/conversation from the inbound webhook.
   */
  async function findConversationId(address: string, username?: string): Promise<number | null> {
    if (isBusinessScopedUserId(address)) return findUsernameConversationId(address, username);
    const phone = address;
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

  /**
   * A WhatsApp username contact has no phone in Chatwoot, and Chatwoot's
   * contact search matches neither the BSUID nor the username. Chatwoot keeps
   * the username in `additional_attributes.social_whatsapp_user_name` and the
   * BSUID as the contact's inbox `source_id`, so scan the inbox's most recent
   * conversations (the person just wrote, so theirs is near the top): match by
   * username, and confirm by `source_id` when there is no username to compare.
   */
  async function findUsernameConversationId(
    bsuid: string,
    username?: string
  ): Promise<number | null> {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      for (let page = 1; page <= USERNAME_SCAN_PAGES; page++) {
        const { data } = await call<{ data: { payload: ChatwootListedConversation[] } }>(
          `/conversations?inbox_id=${inboxId}&status=all&page=${page}`
        );
        const candidates = (data?.payload ?? [])
          .filter((c) => c.inbox_id === inboxId && c.status !== "resolved")
          .filter((c) => c.meta?.sender && !c.meta.sender.phone_number);
        for (const conv of candidates) {
          const sender = conv.meta!.sender!;
          const senderUsername = sender.additional_attributes?.social_whatsapp_user_name;
          if (username && senderUsername) {
            if (senderUsername.toLowerCase() === username.toLowerCase()) return conv.id;
            continue;
          }
          const contact = await call<{
            payload: { contact_inboxes?: Array<{ source_id?: string; inbox?: { id?: number } }> };
          }>(`/contacts/${sender.id}`);
          const inboxes = contact.payload?.contact_inboxes ?? [];
          if (inboxes.some((ci) => ci.source_id === bsuid)) return conv.id;
        }
        if ((data?.payload ?? []).length === 0) break;
      }
      if (attempt < attempts) await sleep(retryDelayMs);
    }
    return null;
  }

  /**
   * Link to the contact's page in the Chatwoot app (all their conversations,
   * including staff replies Mikro never sees). One lookup, no retries; null when
   * unconfigured, not found, or Chatwoot is slow — it only decorates a panel.
   */
  async function findContactUrl(phone: string, timeoutMs = 3000): Promise<string | null> {
    if (!configured) return null;
    const digits = digitsOf(phone);
    const { payload: contacts } = await call<{ payload: ChatwootContact[] }>(
      `/contacts/search?q=${encodeURIComponent(digits)}`,
      { signal: AbortSignal.timeout(timeoutMs) }
    );
    const contact = contacts.find((c) => c.phone_number && digitsOf(c.phone_number) === digits);
    return contact ? `${baseUrl}/app/accounts/${accountId}/contacts/${contact.id}` : null;
  }

  /** Add labels without dropping existing ones (the POST replaces the set). */
  async function addLabels(conversationId: number, labels: string[]): Promise<void> {
    const { payload: current } = await call<{ payload: string[] }>(
      `/conversations/${conversationId}/labels`
    );
    const next = [...new Set([...(current ?? []), ...labels])];
    await call(`/conversations/${conversationId}/labels`, {
      method: "POST",
      body: JSON.stringify({ labels: next })
    });
  }

  return { configured, call, findConversationId, findContactUrl, addLabels };
}
