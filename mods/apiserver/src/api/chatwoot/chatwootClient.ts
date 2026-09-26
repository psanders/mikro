/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The small slice of the Chatwoot API Mikro uses: find a contact's open
 * WhatsApp conversation, post into it, and manage its labels. Shared by the
 * reply mirror (createEchoToChatwoot) and the hand-off note
 * (createNotifyChatwootHandoff).
 */

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
