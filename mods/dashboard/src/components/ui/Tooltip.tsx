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
        className="pointer-events-none absolute left-[calc(100%+9px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-[8px] bg-[#14254A] px-[11px] py-[7px] text-[12px] font-medium text-white opacity-0 shadow-[0_6px_18px_rgba(20,37,74,0.33)] transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
        <span
          aria-hidden
          className="absolute right-full top-1/2 -mr-[3px] h-[9px] w-[9px] -translate-y-1/2 rotate-45 rounded-[2px] bg-[#14254A]"
        />
      </span>
    </div>
  );
}
