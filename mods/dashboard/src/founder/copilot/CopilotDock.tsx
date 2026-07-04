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
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Eraser, PanelRightClose, Sparkles } from "lucide-react";
import { cn } from "../../lib/cn";
import { TypingIndicator } from "./TypingIndicator";

// Textarea grows with content instead of clipping it at one row, capping at
// ~5 lines so a long question can't push the composer to swallow the thread.
const COMPOSER_MAX_HEIGHT = 110;

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
  /** Clears the thread (soft-deletes history) after the inline confirm. Omit to hide the control. */
  onClearHistory?: () => void;
  /** Clear request in flight: disables the confirm button. */
  clearing?: boolean;
  /** Seeds the inline confirm state open. Storybook-only; real usage always starts closed. */
  initialConfirmingClear?: boolean;
  className?: string;
}

export function CopilotDock({
  children,
  value,
  onChange,
  onSend,
  onClose,
  busy = false,
  onClearHistory,
  clearing = false,
  initialConfirmingClear = false,
  className
}: CopilotDockProps) {
  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !busy;
  const threadRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [confirmingClear, setConfirmingClear] = useState(initialConfirmingClear);

  // Scroll the thread to the newest message whenever it changes (send, reply,
  // typing indicator toggling) so the answer never lands below the fold.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [children, busy]);

  // Grow the composer with its content instead of clipping it at one row.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
  }, [value]);

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
        {confirmingClear ? (
          <>
            <span className="text-[13px] font-medium text-[#14254A]">¿Borrar conversación?</span>
            <div className="flex items-center gap-[10px]">
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="text-[13px] font-medium text-[#697A93] transition hover:text-[#14254A]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={clearing}
                onClick={() => {
                  setConfirmingClear(false);
                  onClearHistory?.();
                }}
                className={cn(
                  "text-[13px] font-semibold text-[#B42121] transition hover:text-[#8F1A1A]",
                  clearing && "cursor-not-allowed opacity-50"
                )}
              >
                Borrar
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-[9px]">
              <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] bg-[#1F4AA8]">
                <Sparkles size={14} strokeWidth={2} className="text-white" />
              </div>
              <span className="text-[15px] font-semibold text-[#14254A]">Copiloto</span>
            </div>
            <div className="flex items-center gap-[12px]">
              {onClearHistory && (
                <button
                  type="button"
                  onClick={() => setConfirmingClear(true)}
                  aria-label="Borrar conversación"
                  className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[8px] bg-[#EEF3F9] text-[#697A93] transition hover:bg-[#E1E9F3]"
                >
                  <Eraser size={15} strokeWidth={2} />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar copiloto"
                className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[8px] bg-[#EEF3F9] text-[#697A93] transition hover:bg-[#E1E9F3]"
              >
                <PanelRightClose size={15} strokeWidth={2} />
              </button>
            </div>
          </>
        )}
      </div>

      <div
        ref={threadRef}
        className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto overflow-x-hidden p-[16px]"
      >
        {children}
        {busy && <TypingIndicator />}
      </div>

      <div className="shrink-0 px-[16px] pb-[16px] pt-[12px]">
        <div className="flex items-center gap-[10px] rounded-[12px] border border-[#E5EAF1] bg-[#F4F7FB] px-[14px] py-[11px]">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregunta o pide una acción…"
            className="max-h-[110px] flex-1 resize-none overflow-y-auto bg-transparent text-[13px] font-medium leading-[20px] text-[#14254A] placeholder:text-[#697A93] focus:outline-none"
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
