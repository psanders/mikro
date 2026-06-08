/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Back affordance reusing the context line — the section name links to its list. */
  back?: { label: string; onClick: () => void };
  /** Right-aligned action slot (e.g. a primary Button). */
  action?: ReactNode;
  className?: string;
}

// Mirrors Pencil cp/page-header: surface bar, border-bottom, padding 20×28; left
// title (22px/800, -0.5 tracking) + context line (13px/500 muted), right action
// slot. On detail screens the context line's leading section name is the link
// back to the list (replacing a separate breadcrumb).
export function PageHeader({ title, subtitle, back, action, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between border-b border-ds-border bg-ds-surface px-7 py-5",
        className
      )}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-bold tracking-[-0.5px] text-brand-ink">{title}</h1>
        {(subtitle || back) && (
          <p className="flex items-center gap-[5px] text-[13px] font-medium text-ds-muted">
            {back && (
              <>
                <button
                  type="button"
                  onClick={back.onClick}
                  className="font-medium text-brand-blue-primary hover:underline"
                >
                  {back.label}
                </button>
                <span aria-hidden>/</span>
              </>
            )}
            {subtitle && <span>{subtitle}</span>}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-[10px]">{action}</div>}
    </header>
  );
}
