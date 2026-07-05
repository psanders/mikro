/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Rail tooltip (reframe-bug-report-as-feedback): a small styled label that
 * appears beside an icon on hover, replacing the browser's native `title`
 * attribute across the founder nav rail. Pure CSS — no JS state — so it's
 * cheap and correct: it reveals on `group-hover` AND `group-focus-within`
 * (keyboard users get it too), and on touch devices, which have no hover,
 * it simply never shows. The accessible name is NOT carried by this tooltip:
 * the wrapped control keeps its own `aria-label`, so assistive tech is
 * unaffected regardless of pointer type. `role="tooltip"` + `aria-hidden`
 * keep the decorative label out of the a11y tree.
 *
 * Reveal is delayed (~0.7s) so brushing past an icon doesn't flash a tooltip
 * — the delay is on the show transition only; hiding is immediate. No arrow:
 * a clean floating pill reads better next to the rail than a caret did.
 */
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface TooltipProps {
  /** Visible label text. The wrapped control must still carry its own aria-label. */
  label: string;
  children: ReactNode;
  className?: string;
}

/** Wrap a single rail control; the tooltip renders to its right. */
export function Tooltip({ label, children, className }: TooltipProps) {
  return (
    <div className={cn("group relative flex items-center", className)}>
      {children}
      <span
        role="tooltip"
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-full top-1/2 z-50 ml-[10px] -translate-y-1/2 -translate-x-1",
          "whitespace-nowrap rounded-[7px] bg-[#14254A] px-2.5 py-[7px] text-[12px] font-medium leading-none text-white",
          "opacity-0 shadow-[0_6px_20px_-4px_rgba(20,37,74,0.5)] ring-1 ring-white/10",
          "transition-[opacity,transform] duration-150 ease-out",
          "group-hover:translate-x-0 group-hover:opacity-100 group-hover:delay-[700ms]",
          "group-focus-within:translate-x-0 group-focus-within:opacity-100 group-focus-within:delay-[700ms]"
        )}
      >
        {label}
      </span>
    </div>
  );
}
