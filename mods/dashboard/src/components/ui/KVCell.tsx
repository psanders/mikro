/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface KVCellProps {
  label: string;
  value: ReactNode;
  /** Drop the right divider (last cell in a strip). */
  last?: boolean;
  className?: string;
}

// Mirrors Pencil cp/kv-cell: stacked label/value with a right divider,
// padding 12×16; key 11px/600 muted, value 15px/700 ink.
export function KVCell({ label, value, last, className }: KVCellProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-[2px] px-4 py-3",
        !last && "border-r border-ds-border",
        className
      )}
    >
      <span className="text-[11px] font-medium text-ds-muted">{label}</span>
      <span className="text-[15px] font-medium text-brand-ink">{value}</span>
    </div>
  );
}
