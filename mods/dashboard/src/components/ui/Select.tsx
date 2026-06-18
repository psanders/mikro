/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";

// Standard select control — matches the cp/field input height (see Field) so
// selects render at one consistent, readable size everywhere. Label/error stay
// at the call site, like the native <select> it replaces. Pass `className` to
// extend (e.g. `w-full`). Renders a custom chevron so the arrow sits with
// proper inset instead of flush against the border.
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn("relative", className)}>
      <select
        className="w-full appearance-none rounded-[8px] border border-ds-border bg-ds-surface pl-[14px] pr-[36px] py-[12px] text-sm font-medium text-brand-ink outline-none focus:border-brand-blue-sky"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-[11px] top-1/2 -translate-y-1/2 text-ds-muted"
      />
    </div>
  );
}
