/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Inbox } from "lucide-react";
import { cn } from "../../lib/cn";

interface FeedEmptyStateProps {
  title?: string;
  description?: string;
  className?: string;
}

// Centered placeholder for a feed (or search) with no events yet, in the
// Pencil founder visual language (surface card, radius 14, #E5EAF1 border).
export function FeedEmptyState({
  title = "Todavía no hay eventos",
  description = "Cuando ocurra algo — pagos, solicitudes, préstamos — aparecerá aquí.",
  className
}: FeedEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-3 rounded-[14px] border border-ds-border bg-ds-surface px-6 py-16 text-center",
        className
      )}
    >
      <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[13px] bg-ds-subtle text-ds-muted">
        <Inbox size={24} />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold text-brand-ink">{title}</p>
        <p className="text-[13px] font-medium text-ds-muted">{description}</p>
      </div>
    </div>
  );
}
