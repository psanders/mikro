/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { IconChip } from "./IconChip";

interface StatCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  /** Optional delta line. `tone` sets color (default green); `down` flips the arrow. */
  delta?: { text: string; tone?: "green" | "red"; down?: boolean };
  /** Marks the value as a not-yet-wired placeholder (dims it slightly). */
  placeholder?: boolean;
  className?: string;
}

// Mirrors Pencil cp/stat-card: surface card (radius 12, padding 20, gap 14) with
// a top row (label + icon chip), a 30px/800 value, and a delta line.
export function StatCard({ label, value, icon, delta, placeholder, className }: StatCardProps) {
  const DeltaIcon = delta?.down ? TrendingDown : TrendingUp;
  const deltaColor = delta?.tone === "red" ? "text-ds-red" : "text-ds-green";

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-[14px] rounded-[12px] border border-ds-border bg-ds-surface p-5",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-ds-muted">{label}</span>
        {icon && <IconChip icon={icon} size="sm" />}
      </div>
      <span
        className={cn(
          "text-[30px] font-bold tracking-[-0.5px] text-brand-ink",
          placeholder && "opacity-40"
        )}
      >
        {value}
      </span>
      {delta && (
        <span className={cn("flex items-center gap-[5px] text-[13px] font-medium", deltaColor)}>
          <DeltaIcon size={15} strokeWidth={2.5} />
          {delta.text}
        </span>
      )}
    </div>
  );
}
