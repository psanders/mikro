/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shell-level copilot state (design Decision 8): the dock's open/close lives
 * here so it persists across founder routes (feed / búsqueda / reportes), and
 * `openWith(question?)` lets the feed header's sparkles button and event cards'
 * ask-chips open the dock with an optional prefilled question. The prefill is a
 * `{ text, nonce }` signal so clicking the same chip twice re-prefills the
 * composer even when the text is unchanged.
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

/** A one-shot prefill for the dock composer; `nonce` makes repeats re-fire. */
export interface CopilotPrefill {
  text: string;
  nonce: number;
}

export interface CopilotContextValue {
  open: boolean;
  prefill: CopilotPrefill | null;
  /** Open the dock; with a question, prefill the composer with it. */
  openWith: (question?: string) => void;
  close: () => void;
}

const CopilotContext = createContext<CopilotContextValue | null>(null);

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<CopilotPrefill | null>(null);

  const openWith = useCallback((question?: string) => {
    setOpen(true);
    if (question && question.trim()) {
      setPrefill({ text: question, nonce: Date.now() });
    }
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const value = useMemo<CopilotContextValue>(
    () => ({ open, prefill, openWith, close }),
    [open, prefill, openWith, close]
  );

  return <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>;
}

/** Open/close the copilot dock and prefill its composer from any founder screen. */
export function useCopilot(): CopilotContextValue {
  const ctx = useContext(CopilotContext);
  if (!ctx) throw new Error("useCopilot must be used within a CopilotProvider");
  return ctx;
}
