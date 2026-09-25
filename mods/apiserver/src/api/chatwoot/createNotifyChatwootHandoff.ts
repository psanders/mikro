/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * When a WhatsApp conversation is handed to a human, leave the team a private
 * note in Chatwoot with who it is and what they need, and add the `handoff`
 * label. Who gets the conversation is Chatwoot's call: an automation rule on
 * the label assigns it to a person or team, configured in Chatwoot, so
 * changing the assignee needs no Mikro config or deploy.
 */
import { logger } from "../../logger.js";
import { createChatwootClient, type ChatwootConfig } from "./chatwootClient.js";

/** The label Chatwoot automation rules key on. Create it in Chatwoot. */
export const HANDOFF_LABEL = "handoff";

const PROFILE_LABELS: Record<string, string> = {
  GUEST: "Visitante",
  PROSPECT: "Prospecto (solicitud sin terminar)",
  APPLICANT: "Solicitante (solicitud en revisión)",
  CUSTOMER: "Cliente"
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "sin terminar",
  RECEIVED: "recibida",
  IN_REVIEW: "en revisión",
  PENDING_DECISION: "pendiente de decisión",
  APPROVED: "aprobada",
  REJECTED: "rechazada",
  ABANDONED: "abandonada",
  CONVERTED: "convertida en préstamo"
};

export interface HandoffNoteInput {
  phone: string;
  profile: string;
  reason: string;
  /** Written by the agent that handed off; absent for deterministic hand-offs. */
  summary?: string;
  /** The last few turns, oldest first; used when there is no summary. */
  recentMessages?: Array<{ role: "user" | "assistant"; content: string }>;
  name?: string;
  application?: { id: string; status: string; businessName?: string | null };
  loanIds?: number[];
}

/** The note's text. Pure, so it is tested without Chatwoot. */
export function buildHandoffNote(input: HandoffNoteInput): string {
  const lines = ["🙋 Pase a una persona", ""];
  const who = PROFILE_LABELS[input.profile] ?? input.profile;
  lines.push(`Quién: ${input.name ? `${input.name} · ` : ""}${who}`);
  lines.push(`Motivo: ${input.reason}`);
  if (input.application) {
    const status = STATUS_LABELS[input.application.status] ?? input.application.status;
    const business = input.application.businessName ? ` · ${input.application.businessName}` : "";
    lines.push(`Solicitud: ${status}${business} (id ${input.application.id})`);
  }
  if (input.loanIds?.length) {
    lines.push(`Préstamos activos: ${input.loanIds.map((id) => `#${id}`).join(", ")}`);
  }
  if (input.summary?.trim()) {
    lines.push("", "Resumen:", input.summary.trim());
  } else if (input.recentMessages?.length) {
    lines.push("", "Últimos mensajes:");
    for (const m of input.recentMessages) {
      const text = m.content.replace(/\s+/g, " ").trim().slice(0, 300);
      if (text) lines.push(`${m.role === "user" ? "Persona" : "Bot"}: ${text}`);
    }
  }
  lines.push("", "Los agentes no responderán a este número mientras el pase esté abierto (24h).");
  return lines.join("\n");
}

export interface NotifyChatwootHandoffDeps extends ChatwootConfig {
  /** Facts about the person for the note (application stage, active loans). */
  lookupFacts: (input: {
    applicationId?: string;
    customerId?: string;
  }) => Promise<Pick<HandoffNoteInput, "name" | "application" | "loanIds">>;
}

/**
 * Creates the notifier. Never throws: the hand-off itself (DB record, feed
 * card, silence) already happened; the note is an aid. Returns whether it
 * was posted.
 */
export function createNotifyChatwootHandoff(deps: NotifyChatwootHandoffDeps) {
  const chatwoot = createChatwootClient(deps);

  return async (
    input: Omit<HandoffNoteInput, "name" | "application" | "loanIds"> & {
      applicationId?: string;
      customerId?: string;
      displayName?: string;
    }
  ): Promise<boolean> => {
    if (!chatwoot.configured) return false;
    try {
      const facts = await deps.lookupFacts({
        applicationId: input.applicationId,
        customerId: input.customerId
      });
      const content = buildHandoffNote({
        ...input,
        ...facts,
        name: facts.name ?? input.displayName
      });
      const conversationId = await chatwoot.findConversationId(input.phone);
      if (conversationId == null) {
        logger.warn("chatwoot hand-off: no open conversation for contact", { phone: input.phone });
        return false;
      }
      // A private note is never delivered to the customer.
      await chatwoot.call(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content, message_type: "outgoing", private: true })
      });
      await chatwoot.addLabels(conversationId, [HANDOFF_LABEL]);
      logger.info("chatwoot hand-off: note posted and labeled", {
        phone: input.phone,
        conversationId
      });
      return true;
    } catch (err) {
      logger.error("chatwoot hand-off: request failed", {
        phone: input.phone,
        error: err instanceof Error ? err.message : String(err)
      });
      return false;
    }
  };
}
