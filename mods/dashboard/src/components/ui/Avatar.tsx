/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { cn } from "../../lib/cn";

interface AvatarProps {
  initials: string;
  /** Diameter in px. Default 36. */
  size?: number;
  className?: string;
}

// Round monogram avatar. Matches Pencil's table avatars: ds.subtle (light gray)
// background with muted initials.
export function Avatar({ initials, size = 36, className }: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-ds-subtle font-medium text-ds-muted",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  );
}

/** First letters of the first two words, uppercased. */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}
