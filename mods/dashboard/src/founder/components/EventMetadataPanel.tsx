/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Raw-JSON view of a feed event, opened via a card's "Metadata" link —
 * Pencil `EzobQ` row `VIflA`, node `I3Lmb` ("Elemento eliminado — Metadata
 * al hacer clic"). Same rendering for every event type; no per-type logic.
 */
import { Braces, X } from "lucide-react";
import type { FeedEvent } from "./types";

export interface EventMetadataPanelProps {
  event: FeedEvent;
  onClose: () => void;
}

export function EventMetadataPanel({ event, onClose }: EventMetadataPanelProps) {
  const { type, occurredAt, actorName, payload } = event;
  const json = JSON.stringify({ type, occurredAt, actorName, ...payload }, null, 2);

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-[#E5EAF1] bg-white p-4">
      <div className="flex items-center gap-2">
        <Braces size={15} className="text-[#697A93]" />
        <span className="flex-1 text-[13px] font-semibold text-[#14254A]">Metadata</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex items-center justify-center text-[#697A93] hover:text-[#14254A]"
        >
          <X size={15} />
        </button>
      </div>
      <pre className="overflow-x-auto rounded-[10px] border border-[#2C4373] bg-[#14254A] p-[14px] font-mono text-[11px] leading-[1.5] text-[#D7E1F2]">
        {json}
      </pre>
      <p className="text-[11px] font-medium text-[#697A93]">
        Estructura cruda del registro (payload del evento); útil para soporte y depuración.
      </p>
    </div>
  );
}
