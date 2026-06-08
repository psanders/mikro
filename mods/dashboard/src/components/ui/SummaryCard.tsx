/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { IconChip } from "./IconChip";
import { KVCell } from "./KVCell";

interface SummaryItem {
  label: string;
  value: ReactNode;
}

interface SummaryCardProps {
  icon: LucideIcon;
  title: ReactNode;
  meta?: string;
  /** Cells rendered in the bottom strip. */
  items: SummaryItem[];
  className?: string;
}

// Mirrors Pencil cp/summary-card: surface card (radius 14, padding 20, gap 16)
// with a header (large icon chip + title/meta) and a KV-cell strip.
export function SummaryCard({ icon, title, meta, items, className }: SummaryCardProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-4 rounded-[14px] border border-ds-border bg-ds-surface p-5",
        className
      )}
    >
      <div className="flex items-center gap-4">
        <IconChip icon={icon} size="lg" />
        <div className="flex flex-1 flex-col gap-[5px]">
          {typeof title === "string" ? (
            <span className="text-[20px] font-bold tracking-[-0.4px] text-brand-ink">{title}</span>
          ) : (
            title
          )}
          {meta && <span className="text-[13px] font-medium text-ds-muted">{meta}</span>}
        </div>
      </div>
      <div className="flex overflow-hidden rounded-[10px] border border-ds-border bg-ds-bg">
        {items.map((item, i) => (
          <KVCell
            key={item.label}
            label={item.label}
            value={item.value}
            last={i === items.length - 1}
            className="flex-1"
          />
        ))}
      </div>
    </div>
  );
}
