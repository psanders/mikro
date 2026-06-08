/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

export type IconChipTone = "blue" | "green" | "amber" | "red";

interface IconChipProps {
  icon: LucideIcon;
  /** sm = 32×32 / radius 8 / 16px icon; lg = 52×52 / radius 13 / 24px icon. */
  size?: "sm" | "lg";
  /** Icon color (background stays ds.subtle). Default blue. */
  tone?: IconChipTone;
  className?: string;
}

const TONE: Record<IconChipTone, string> = {
  blue: "text-brand-blue-primary",
  green: "text-ds-green",
  amber: "text-ds-amber",
  red: "text-ds-red"
};

// Mirrors Pencil cp/icon-chip-sm / cp/icon-chip-lg: ds.subtle square with a
// centered icon (color per tone).
export function IconChip({ icon: Icon, size = "sm", tone = "blue", className }: IconChipProps) {
  const sm = size === "sm";
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-ds-subtle",
        TONE[tone],
        sm ? "h-8 w-8 rounded-[8px]" : "h-[52px] w-[52px] rounded-[13px]",
        className
      )}
    >
      <Icon size={sm ? 16 : 24} strokeWidth={2} />
    </div>
  );
}
