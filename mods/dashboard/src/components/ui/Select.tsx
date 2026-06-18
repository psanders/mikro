/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

// Standard select control — matches the cp/field input height (see Field) so
// selects render at one consistent, readable size everywhere. Label/error stay
// at the call site, like the native <select> it replaces. Pass `className` to
// extend (e.g. `w-full`, or `text-ds-muted` for an empty/placeholder state).
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "rounded-[8px] border border-ds-border bg-ds-surface px-[14px] py-[12px] text-sm font-medium text-brand-ink outline-none focus:border-brand-blue-sky",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
