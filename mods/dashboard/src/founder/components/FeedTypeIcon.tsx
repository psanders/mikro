/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { cn } from "../../lib/cn";
import { FEED_CHIP_BG, FEED_ICON_TONE, resolveVisual } from "./typeConfig";
import type { FeedEvent } from "./types";

interface FeedTypeIconProps {
  event: FeedEvent;
  /** md = 36×36 (feed row, default); sm = 30×30 (search event row). */
  size?: "sm" | "md";
  className?: string;
}

// The accent-tinted icon chip shared by the feed row and the search "evento"
// row, so both surfaces resolve the same icon/accent per event type from a
// single place (Pencil: green pill for payments, blue for the rest, red/amber
// for destructive/exception).
export function FeedTypeIcon({ event, size = "md", className }: FeedTypeIconProps) {
  const { icon: Icon, accent } = resolveVisual(event);
  const md = size === "md";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        FEED_CHIP_BG[accent],
        FEED_ICON_TONE[accent],
        md ? "h-9 w-9 rounded-[11px]" : "h-[30px] w-[30px] rounded-[9px]",
        className
      )}
    >
      <Icon size={md ? 17 : 14} strokeWidth={2} />
    </div>
  );
}
