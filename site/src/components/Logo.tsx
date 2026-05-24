/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { clsx } from "clsx";

interface LogoProps {
  /** Footer variant: white wordmark on dark background */
  inverted?: boolean;
  compact?: boolean;
  className?: string;
}

export function Logo({ inverted = false, compact = false, className }: LogoProps) {
  const markSize = compact ? "h-[35px] w-[35px]" : "h-10 w-10";
  const markRadius = compact ? "rounded-[9px]" : "rounded-[10px]";
  const mSize = compact ? "text-[17px]" : "text-2xl";
  const wordSize = compact ? "text-[28px]" : "text-[32px]";

  return (
    <div className={clsx("flex items-center", compact ? "gap-3" : "gap-3.5", className)}>
      <div
        className={clsx(
          markSize,
          markRadius,
          "flex items-center justify-center pb-1",
          inverted ? "bg-white" : "bg-brand-blue-deep"
        )}
      >
        <span
          className={clsx(
            mSize,
            "font-bold leading-none rotate-[0.27deg]",
            inverted ? "text-brand-blue-deep" : "text-white"
          )}
        >
          m
        </span>
      </div>
      <span
        className={clsx(
          wordSize,
          "font-bold tracking-[-0.5px]",
          inverted ? "text-white" : "text-brand-blue-deep"
        )}
      >
        mikro
      </span>
    </div>
  );
}
