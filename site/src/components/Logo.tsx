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
  const markSize = compact ? "h-7 w-7" : "h-8 w-8";
  const markRadius = compact ? "rounded-[8px]" : "rounded-[10px]";
  const mSize = compact ? "text-[17px]" : "text-2xl";
  const wordSize = compact ? "text-[21px]" : "text-[24px]";

  return (
    <div className={clsx("flex items-center gap-2.5", className)}>
      <div
        className={clsx(
          markSize,
          markRadius,
          "flex items-center justify-center",
          inverted ? "bg-white" : "bg-brand-blue-deep"
        )}
      >
        <span
          className={clsx(
            mSize,
            "font-bold leading-none",
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
