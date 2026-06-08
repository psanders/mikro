/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { cn } from "../../lib/cn";
import type { BadgeTone } from "./Badge";

// Pencil v2 lists render status as plain text (no pill): muted by default, with
// color reserved for meaningful signals (green = new/actionable, red = risk).
const TONE: Record<BadgeTone, string> = {
  green: "text-ds-green",
  amber: "text-ds-amber",
  red: "text-ds-red",
  neutral: "text-ds-muted"
};

export function StatusText({
  tone = "neutral",
  children,
  className
}: {
  tone?: BadgeTone;
  children: string;
  className?: string;
}) {
  return <span className={cn("text-[13px] font-medium", TONE[tone], className)}>{children}</span>;
}
