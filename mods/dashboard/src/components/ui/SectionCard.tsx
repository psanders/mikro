/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { IconChip } from "./IconChip";

interface SectionCardProps {
  icon: LucideIcon;
  title: string;
  /** Right-aligned summary text next to the chevron. */
  meta?: string;
  /** Rotates the chevron; render children when open. */
  open?: boolean;
  /** When provided, the header becomes a toggle button. */
  onToggle?: () => void;
  children?: ReactNode;
  className?: string;
}

// Mirrors Pencil cp/section-card: surface card (radius 14, border) with a head
// (icon chip + 15px title, meta + chevron) and an optional collapsible body.
export function SectionCard({
  icon,
  title,
  meta,
  open,
  onToggle,
  children,
  className
}: SectionCardProps) {
  const head = (
    <>
      <div className="flex items-center gap-3">
        <IconChip icon={icon} size="sm" />
        <span className="text-[15px] font-medium text-brand-ink">{title}</span>
      </div>
      <div className="flex items-center gap-3">
        {meta && <span className="text-[13px] font-medium text-ds-muted">{meta}</span>}
        <ChevronDown
          size={18}
          className={cn("text-ds-muted transition-transform", open && "rotate-180")}
        />
      </div>
    </>
  );
  return (
    <section
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-[14px] border border-ds-border bg-ds-surface",
        className
      )}
    >
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between px-[18px] py-[15px] text-left"
        >
          {head}
        </button>
      ) : (
        <div className="flex items-center justify-between px-[18px] py-[15px]">{head}</div>
      )}
      {open && children && <div className="border-t border-ds-border p-6">{children}</div>}
    </section>
  );
}
