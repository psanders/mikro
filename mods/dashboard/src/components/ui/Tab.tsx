/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

interface TabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: string;
}

// Mirrors Pencil cp/tab: pill-ish tab, padding 8×14, 13px/600. Inactive is
// transparent/muted; active fills with brand mist + primary text.
export function Tab({ active, children, className, ...props }: TabProps) {
  return (
    <button
      className={cn(
        "rounded-[8px] px-[14px] py-2 text-[13px] transition",
        active
          ? "bg-brand-mist font-medium text-brand-blue-primary"
          : "font-medium text-ds-muted hover:bg-ds-subtle",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
