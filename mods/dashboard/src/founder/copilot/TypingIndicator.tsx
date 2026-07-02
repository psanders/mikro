/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The "copiloto is thinking" affordance shown in the thread while a chat
 * request is in flight — three softly pulsing dots in a left-aligned pill.
 */
import { cn } from "../../lib/cn";

export interface TypingIndicatorProps {
  className?: string;
}

export function TypingIndicator({ className }: TypingIndicatorProps) {
  return (
    <div
      className={cn(
        "flex w-fit items-center gap-[5px] rounded-[12px] bg-[#F4F7FB] px-[14px] py-[11px]",
        className
      )}
      role="status"
      aria-label="El copiloto está escribiendo"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-[6px] w-[6px] animate-pulse rounded-full bg-[#8FA3C8]"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}
