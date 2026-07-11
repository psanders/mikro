/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * A left-aligned assistant turn — Pencil `asst`: the reply text (optionally
 * arbitrary children such as a rule/action card) with a provenance source line
 * underneath when the reply used tools. The system prompt governs when the
 * model reaches for markdown — prose for analysis, bullet lists for
 * enumerable facts — and replies render through `markdown-to-jsx` so that
 * markup displays as intended instead of showing literal `**`/`-` characters.
 */
import type { ReactNode } from "react";
import Markdown from "markdown-to-jsx";
import { cn } from "../../lib/cn";
import { ProvenanceLine } from "./ProvenanceLine";
import type { CopilotProvenance } from "./types";

export interface AssistantMessageProps {
  /** The reply body text. Omit when the message is only a card (via children). */
  text?: string;
  provenance?: CopilotProvenance;
  /** Card content (RuleCard / PendingActionCard) rendered above the source line. */
  children?: ReactNode;
  className?: string;
}

// Shared with PendingActionCard so a card's "Copiloto said X" line always
// matches markdown body text exactly — these drifted 1px apart before
// (14px vs 13px) simply because nothing forced them to stay in sync.
export const ASSISTANT_TEXT_CLASS = "text-[13px] font-medium leading-[20px] text-[#14254A]";
const TEXT_CLASS = ASSISTANT_TEXT_CLASS;

// break-words on every text-bearing override: assistant replies can embed
// long unbroken tokens (e.g. a WhatsApp message ID echoed back from a tool
// result) that would otherwise force the copilot dock wider than its fixed
// 430px and overflow horizontally instead of wrapping.
const MARKDOWN_OPTIONS = {
  disableParsingRawHTML: true,
  // Short, single-line replies (e.g. tool-result confirmations like "Hecho.
  // Promoción enviada...") have no block-level markdown syntax, so without
  // this markdown-to-jsx emits a bare text node instead of a <p> — skipping
  // every override below (size, weight, break-words) and falling back to
  // browser defaults, which is what caused the oversized/overflowing text.
  forceBlock: true,
  overrides: {
    p: { props: { className: cn(TEXT_CLASS, "w-full min-w-0 mb-[6px] break-words last:mb-0") } },
    strong: { props: { className: "font-semibold" } },
    em: { props: { className: "italic" } },
    ul: {
      props: {
        className: cn(
          TEXT_CLASS,
          "w-full min-w-0 mb-[6px] list-disc space-y-[2px] break-words pl-[18px] last:mb-0"
        )
      }
    },
    ol: {
      props: {
        className: cn(
          TEXT_CLASS,
          "w-full min-w-0 mb-[6px] list-decimal space-y-[2px] break-words pl-[18px] last:mb-0"
        )
      }
    },
    li: { props: { className: "break-words pl-[2px]" } },
    a: {
      props: {
        className: "break-words underline underline-offset-2",
        target: "_blank",
        rel: "noreferrer"
      }
    },
    code: {
      props: {
        className: "break-words rounded-[4px] bg-[#EEF3F9] px-[4px] py-[1px] font-mono text-[12px]"
      }
    }
  }
};

export function AssistantMessage({ text, provenance, children, className }: AssistantMessageProps) {
  return (
    <div className={cn("flex w-full min-w-0 flex-col items-start gap-[10px]", className)}>
      {text && (
        // Bound the markdown to the dock width so a long unbreakable token
        // (e.g. a WhatsApp message ID) wraps via break-words instead of forcing
        // the paragraph wider than the dock and getting clipped. A flex child of
        // items-start otherwise sizes to its content, defeating overflow-wrap.
        <div className="w-full min-w-0">
          <Markdown options={MARKDOWN_OPTIONS}>{text}</Markdown>
        </div>
      )}
      {children}
      {provenance && <ProvenanceLine provenance={provenance} />}
    </div>
  );
}
