/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The `conversation.audited` feed card (Pencil EzobQ §09, `PoM6l`): it only
 * says whether the conversations comply — the headline, one status paragraph
 * (the card's narrative) and "Ver detalle", which opens the findings side
 * panel. Renders from the event payload; only the panel fetches.
 */
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { FeedCard, type FeedCardProps } from "../components/FeedCard";
import { ConversationAuditPanel } from "./ConversationAuditPanel";

export type ConversationAuditFeedCardProps = Omit<
  FeedCardProps,
  "detailSlot" | "actionSlot" | "hideLinks"
> & {
  onOpenConversation?: (applicationId: string) => void;
};

export function ConversationAuditFeedCard(props: ConversationAuditFeedCardProps) {
  const { event, onOpenConversation, ...rest } = props;
  const [panelOpen, setPanelOpen] = useState(false);
  const runId = typeof event.payload.runId === "string" ? event.payload.runId : "";

  return (
    <div data-testid="audit-card">
      <FeedCard
        {...rest}
        event={event}
        hideLinks
        detailSlot={
          runId && (
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              data-testid="audit-open-detail"
              className="inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-[#1F4AA8] hover:text-[#14356e]"
            >
              Ver detalle
              <ArrowRight size={14} />
            </button>
          )
        }
      />
      {panelOpen && (
        <ConversationAuditPanel
          runId={runId}
          onClose={() => setPanelOpen(false)}
          onOpenConversation={(applicationId) => {
            setPanelOpen(false);
            onOpenConversation?.(applicationId);
          }}
        />
      )}
    </div>
  );
}
