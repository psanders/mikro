/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { cn } from "../../lib/cn";

interface ProgressBarProps {
  label: string;
  /** Right-aligned descriptor, e.g. "4 de 12 cuotas · 33%". */
  value?: string;
  /** Fill percentage, 0–100. */
  percent: number;
  className?: string;
}

// Mirrors Pencil cp/progress-bar: header (label 13/600 muted + value 13/700 ink)
// over an 8px pill track (ds.subtle) with a brand.blue.primary fill.
export function ProgressBar({ label, value, percent, className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-ds-muted">{label}</span>
        {value && <span className="text-[13px] font-medium text-brand-ink">{value}</span>}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-pill bg-ds-subtle">
        <div className="h-2 rounded-pill bg-brand-blue-primary" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
