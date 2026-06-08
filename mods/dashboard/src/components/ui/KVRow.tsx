/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface KVRowProps {
  label: string;
  value: ReactNode;
  /** Drop the bottom divider (last row in a strip). */
  last?: boolean;
  className?: string;
}

// Mirrors Pencil cp/kv-row: horizontal label/value with a bottom divider,
// padding 12×16; key 13px/500 muted, value 13px/700 ink.
export function KVRow({ label, value, last, className }: KVRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3",
        !last && "border-b border-ds-border",
        className
      )}
    >
      <span className="text-[13px] font-medium text-ds-muted">{label}</span>
      <span className="text-[13px] font-medium text-brand-ink">{value}</span>
    </div>
  );
}
