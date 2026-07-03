/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * A left-aligned assistant turn — Pencil `asst`: the reply text (optionally
 * arbitrary children such as a rule/action card) with a provenance source line
 * underneath when the reply used tools. The model isn't instructed to avoid
 * markdown, so replies render through `markdown-to-jsx` — bold/lists/etc.
 * display instead of showing literal `**`/`-` characters.
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

const TEXT_CLASS = "text-[13px] font-medium leading-[20px] text-[#14254A]";

const MARKDOWN_OPTIONS = {
  disableParsingRawHTML: true,
  overrides: {
    p: { props: { className: cn(TEXT_CLASS, "mb-[6px] last:mb-0") } },
    strong: { props: { className: "font-bold" } },
    em: { props: { className: "italic" } },
    ul: {
      props: { className: cn(TEXT_CLASS, "mb-[6px] list-disc space-y-[2px] pl-[18px] last:mb-0") }
    },
    ol: {
      props: {
        className: cn(TEXT_CLASS, "mb-[6px] list-decimal space-y-[2px] pl-[18px] last:mb-0")
      }
    },
    li: { props: { className: "pl-[2px]" } },
    a: {
      props: { className: "underline underline-offset-2", target: "_blank", rel: "noreferrer" }
    },
    code: {
      props: { className: "rounded-[4px] bg-[#EEF3F9] px-[4px] py-[1px] font-mono text-[12px]" }
    }
  }
};

export function AssistantMessage({ text, provenance, children, className }: AssistantMessageProps) {
  return (
    <div className={cn("flex w-full flex-col items-start gap-[10px]", className)}>
      {text && <Markdown options={MARKDOWN_OPTIONS}>{text}</Markdown>}
      {children}
      {provenance && <ProvenanceLine provenance={provenance} />}
    </div>
  );
}
