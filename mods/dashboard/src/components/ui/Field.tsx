/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { InputHTMLAttributes } from "react";
import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Optional leading icon (lucide). */
  icon?: LucideIcon;
  /** Error message; shown below and turns the input red. */
  error?: string;
}

// Mirrors Pencil cp/field: vertical, gap 7 — label (13px/600 ink) over a bordered
// input box (radius 8, border ds.border, padding 12×14, gap 10) with a 16px
// ds.muted leading icon and 14px/500 ink text.
export function Field({ label, icon: Icon, error, className, id, ...props }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className="flex w-full flex-col gap-[7px]">
      <label htmlFor={inputId} className="text-[13px] font-medium text-brand-ink">
        {label}
      </label>
      <div
        className={cn(
          "flex items-center gap-[10px] rounded-[8px] border bg-ds-surface px-[14px] py-[12px]",
          "focus-within:border-brand-blue-sky",
          error ? "border-ds-red" : "border-ds-border"
        )}
      >
        {Icon && <Icon size={16} className="shrink-0 text-ds-muted" />}
        <input
          id={inputId}
          className={cn(
            "w-full bg-transparent text-sm font-medium text-brand-ink outline-none",
            "placeholder:text-ds-muted",
            className
          )}
          {...props}
        />
      </div>
      {error && <span className="text-[13px] text-ds-red">{error}</span>}
    </div>
  );
}
