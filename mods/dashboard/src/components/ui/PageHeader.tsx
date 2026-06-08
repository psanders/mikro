/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-aligned action slot (e.g. a primary Button). */
  action?: ReactNode;
  className?: string;
}

// Mirrors Pencil cp/page-header: surface bar, border-bottom, padding 20×28; left
// title (22px/800, -0.5 tracking) + subtitle (13px/500 muted), right action slot.
export function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between border-b border-ds-border bg-ds-surface px-7 py-5",
        className
      )}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-bold tracking-[-0.5px] text-brand-ink">{title}</h1>
        {subtitle && <p className="text-[13px] font-medium text-ds-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-[10px]">{action}</div>}
    </header>
  );
}
