/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Calculator, MessageCircle } from "lucide-react";
import { clsx } from "clsx";

interface SecondaryButtonProps {
  variant: "calculator" | "whatsapp";
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export function SecondaryButton({
  variant,
  children,
  className,
  fullWidth = false
}: SecondaryButtonProps) {
  const Icon = variant === "calculator" ? Calculator : MessageCircle;

  return (
    <button
      type="button"
      className={clsx(
        "inline-flex items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-white/30 bg-transparent px-7 py-[18px] text-[17px] font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/10",
        fullWidth && "w-full",
        className
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      {children}
    </button>
  );
}
