/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * A left-aligned assistant turn — Pencil `asst`: the reply text (optionally
 * arbitrary children such as a rule/action card) with a provenance source line
 * underneath when the reply used tools.
 */
import type { ReactNode } from "react";
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

export function AssistantMessage({ text, provenance, children, className }: AssistantMessageProps) {
  return (
    <div className={cn("flex w-full flex-col items-start gap-[10px]", className)}>
      {text && (
        <p className="w-full text-[13px] font-medium leading-[20px] text-[#14254A]">{text}</p>
      )}
      {children}
      {provenance && <ProvenanceLine provenance={provenance} />}
    </div>
  );
}
