/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Presentational dock frame — Pencil `copilotDock` (copilot.html /
 * feed-dock-open.html): a ~430px right panel with a header (sparkles mark,
 * "Copiloto", close control), a scrollable thread area
 * (children), and a composer (auto-submitting textarea + send button). Open /
 * close and thread contents are owned by the parent; the composer is controlled
 * via value/onChange so ask-chips can prefill it. `busy` disables sending and
 * shows the typing indicator at the foot of the thread.
 */
import type { KeyboardEvent, ReactNode } from "react";
import { ArrowUp, PanelRightClose, Sparkles } from "lucide-react";
import { cn } from "../../lib/cn";
import { TypingIndicator } from "./TypingIndicator";

export interface CopilotDockProps {
  /** Thread content — bubbles, cards, capability chips. */
  children?: ReactNode;
  /** Controlled composer value. */
  value: string;
  onChange: (value: string) => void;
  /** Emits the trimmed composer text; the parent clears `value`. */
  onSend: (message: string) => void;
  onClose: () => void;
  /** Request in flight: disables sending and shows the typing indicator. */
  busy?: boolean;
  className?: string;
}

export function CopilotDock({
  children,
  value,
  onChange,
  onSend,
  onClose,
  busy = false,
  className
}: CopilotDockProps) {
  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !busy;

  function handleSend() {
    if (!canSend) return;
    onSend(trimmed);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className={cn(
        "flex h-full w-[430px] shrink-0 flex-col border-l border-t border-[#E5EAF1] bg-white",
        className
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[#E5EAF1] px-[18px] py-[16px]">
        <div className="flex items-center gap-[9px]">
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] bg-[#1F4AA8]">
            <Sparkles size={14} strokeWidth={2} className="text-white" />
          </div>
          <span className="text-[15px] font-bold text-[#14254A]">Copiloto</span>
        </div>
        <div className="flex items-center gap-[12px]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar copiloto"
            className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[8px] bg-[#EEF3F9] text-[#697A93] transition hover:bg-[#E1E9F3]"
          >
            <PanelRightClose size={15} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto p-[16px]">
        {children}
        {busy && <TypingIndicator />}
      </div>

      <div className="shrink-0 px-[16px] pb-[16px] pt-[12px]">
        <div className="flex items-center gap-[10px] rounded-[12px] border border-[#E5EAF1] bg-[#F4F7FB] px-[14px] py-[11px]">
          <textarea
            rows={1}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregunta o pide una acción…"
            className="flex-1 resize-none bg-transparent text-[13px] font-medium text-[#14254A] placeholder:text-[#697A93] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Enviar"
            className={cn(
              "flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[8px] bg-[#1F4AA8] text-white transition hover:bg-[#1A3F8F]",
              !canSend && "cursor-not-allowed opacity-50 hover:bg-[#1F4AA8]"
            )}
          >
            <ArrowUp size={14} strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </div>
  );
}
