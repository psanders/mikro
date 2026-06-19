/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { CircleCheck, CircleX, X } from "lucide-react";
import { cn } from "../../lib/cn";

export type ToastVariant = "success" | "error";

interface ToastProps {
  variant: ToastVariant;
  message: string;
  onDismiss: () => void;
  className?: string;
}

const VARIANTS: Record<ToastVariant, { bg: string; icon: typeof CircleCheck }> = {
  success: { bg: "bg-ds-green", icon: CircleCheck },
  error: { bg: "bg-ds-red", icon: CircleX }
};

// Floating transient-feedback toast. Presentational only — placement, timeout,
// and lifecycle live in ToastProvider so every usage behaves identically.
export function Toast({ variant, message, onDismiss, className }: ToastProps) {
  const { bg, icon: Icon } = VARIANTS[variant];
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2 rounded-[10px] px-4 py-3 text-white shadow-lg",
        bg,
        className
      )}
    >
      <Icon size={16} className="shrink-0" />
      <span className="text-[13px] font-medium">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar"
        className="ml-1 text-current opacity-70 hover:opacity-100"
      >
        <X size={15} />
      </button>
    </div>
  );
}
