/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { ChevronRight, Gauge, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

export interface NavItem {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

interface NavUser {
  name: string;
  role: string;
  initials: string;
}

interface NavSidebarProps {
  items: NavItem[];
  user: NavUser;
  onConfigClick?: () => void;
  onUserClick?: () => void;
  className?: string;
}

// A menu row — active gets the #EAF1FB highlight + brand-primary icon/label.
function MenuRow({ icon: Icon, label, active, onClick }: NavItem) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-[11px] rounded-[8px] px-3 py-[10px] text-left text-sm transition",
        active
          ? "bg-[#EAF1FB] font-medium text-brand-blue-primary"
          : "font-medium text-brand-ink hover:bg-ds-subtle"
      )}
    >
      <Icon size={17} className={active ? "text-brand-blue-primary" : "text-ds-muted"} />
      <span className="flex-1">{label}</span>
    </button>
  );
}

// Mirrors Pencil cp/nav-sidebar-v2: 248px white rail, border-right, logo mark
// (46px, rounded-13, gauge badge) + hairline divider + items at the top,
// divider + Configuración + user card pinned to the bottom.
export function NavSidebar({
  items,
  user,
  onConfigClick,
  onUserClick,
  className
}: NavSidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full w-[248px] flex-col justify-between border-r border-ds-border bg-ds-surface px-[14px] py-5",
        className
      )}
    >
      <div className="flex flex-col gap-[18px]">
        {/* Logo */}
        <div className="flex items-center gap-[11px] px-[4px] py-[2px]">
          <div className="relative flex h-[46px] w-[46px] flex-col items-center justify-center rounded-[13px] bg-brand-blue-deep pb-[4px]">
            <span
              className="text-[26px] font-extrabold leading-none text-brand-white"
              style={{ transform: "rotate(-0.27deg)" }}
            >
              m
            </span>
            <div className="absolute bottom-[3px] right-[3px] flex h-[17px] w-[17px] items-center justify-center rounded-[9px] bg-brand-white">
              <Gauge size={11} className="text-brand-blue-deep" />
            </div>
          </div>
          <div className="flex flex-col gap-px">
            <span className="text-[19px] font-bold tracking-[-0.3px] text-brand-ink">mikro</span>
            <span className="text-[10px] font-medium uppercase tracking-[2px] text-ds-muted">
              ops
            </span>
          </div>
        </div>

        <div className="h-px w-full bg-ds-border" />

        <nav className="flex flex-col gap-[2px]">
          {items.map((item) => (
            <MenuRow key={item.label} {...item} />
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-[10px]">
        <div className="h-px w-full bg-ds-border" />
        <MenuRow icon={Settings} label="Configuración" onClick={onConfigClick} />
        <button
          type="button"
          onClick={onUserClick}
          className="flex w-full items-center gap-[10px] rounded-[10px] bg-ds-subtle p-[11px] text-left"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue-primary text-xs font-bold text-brand-white">
            {user.initials}
          </div>
          <div className="flex flex-1 flex-col gap-px">
            <span className="text-[13px] font-medium text-brand-ink">{user.name}</span>
            <span className="text-[11px] font-medium text-ds-muted">{user.role}</span>
          </div>
          <ChevronRight size={16} className="text-ds-muted" />
        </button>
      </div>
    </aside>
  );
}
