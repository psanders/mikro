/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { CircleAlert } from "lucide-react";
import { cn } from "../../lib/cn";

interface FeedErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

// Centered error placeholder — the dashboard is online-only, so a failed
// feed/search load is always "check your connection and retry".
export function FeedErrorState({
  title = "No se pudo cargar el feed",
  description = "Verifica tu conexión e inténtalo de nuevo.",
  onRetry,
  className
}: FeedErrorStateProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-3 rounded-[14px] border border-ds-border bg-ds-surface px-6 py-16 text-center",
        className
      )}
    >
      <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[13px] bg-ds-red-bg text-ds-red">
        <CircleAlert size={24} />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold text-brand-ink">{title}</p>
        <p className="text-[13px] font-medium text-ds-muted">{description}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center rounded-[9px] border border-ds-border bg-ds-surface px-4 py-[9px] text-[14px] font-medium text-brand-ink transition hover:bg-ds-bg"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
