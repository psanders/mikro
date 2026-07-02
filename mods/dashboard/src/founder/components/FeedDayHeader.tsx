/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { cn } from "../../lib/cn";
import { formatDayLabel } from "./format";

interface FeedDayHeaderProps {
  /** ISO 8601 timestamp for any event in the group — only the calendar day matters. */
  date: string;
  className?: string;
}

// Day-group separator band for the feed list ("Ayer" / "24 de junio"). Uses
// the Pencil group-label treatment (11px, tracked, muted) on a faint band so
// it reads as a divider between days.
export function FeedDayHeader({ date, className }: FeedDayHeaderProps) {
  return (
    <div
      className={cn(
        "w-full border-b border-[#E5EAF1] bg-[#F4F7FB] px-6 py-2 text-[11px] font-semibold uppercase tracking-[0.8px] text-[#697A93]",
        className
      )}
    >
      {formatDayLabel(date)}
    </div>
  );
}
