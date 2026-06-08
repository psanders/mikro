/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "success";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Optional leading icon (lucide). */
  icon?: LucideIcon;
  /** Stretch to the container width (e.g. the login submit button). */
  block?: boolean;
}

// Mirrors Pencil cp/btn, cp/btn-primary, cp/btn-success: 14px/700 label, 16px
// leading icon, gap 7, padding 11×18, radius 9.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-blue-primary text-brand-white hover:opacity-90",
  secondary: "bg-ds-surface text-brand-ink border border-ds-border hover:bg-ds-subtle",
  success: "bg-ds-green text-brand-white hover:opacity-90"
};

export function Button({
  variant = "primary",
  icon: Icon,
  block = false,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-[7px] rounded-[9px] px-[18px] py-[11px]",
        "text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        block && "w-full",
        VARIANTS[variant],
        className
      )}
      {...props}
    >
      {Icon && <Icon size={16} strokeWidth={2} />}
      {children}
    </button>
  );
}
