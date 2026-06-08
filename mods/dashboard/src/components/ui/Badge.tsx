/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

export type BadgeTone = "green" | "amber" | "red" | "neutral";

interface BadgeProps {
  tone?: BadgeTone;
  icon?: LucideIcon;
  /** Render a small leading status dot (Pencil status-chip style). */
  dot?: boolean;
  children: string;
  className?: string;
}

// Mirrors Pencil cp/badge-icon: pill, padding 4×10, 12px/500 label. The status
// variant (neutral + dot) is a light-gray pill with a small muted dot, per the
// Pencil designs.
const TONES: Record<BadgeTone, string> = {
  green: "bg-ds-green-bg text-ds-green",
  amber: "bg-ds-amber-bg text-ds-amber",
  red: "bg-ds-red-bg text-ds-red",
  neutral: "bg-ds-subtle text-ds-muted"
};

export function Badge({ tone = "neutral", icon: Icon, dot, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[6px] rounded-pill px-[10px] py-[4px] text-xs font-medium",
        TONES[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {Icon && <Icon size={13} strokeWidth={2.5} />}
      {children}
    </span>
  );
}
