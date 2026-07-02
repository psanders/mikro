/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Self-contained founder shell — Pencil "Feed en vivo" board (`EzobQ`). A slim
 * dark-on-white icon rail (feed home, exceptions [inert], búsqueda, reportes,
 * profile) on the left, the active screen on the right. Rendered OUTSIDE the
 * operations Layout: an admin on any `/founder` route sees only this chrome.
 */
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { FileText, House, ShipWheel, Search, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";
import { trpc } from "../lib/trpc";
import { BugReportButton } from "../components/BugReportButton";
import { CopilotProvider } from "./copilot/CopilotContext";
import { CopilotDockContainer } from "./copilot/CopilotDockContainer";

interface RailItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
  /** Inert = present per the design but not yet wired (tooltip "Próximamente"). */
  inert?: boolean;
  /** Small red presence badge (exceptions rail icon). */
  badge?: boolean;
}

function RailItem({ icon: Icon, label, active, onClick, inert, badge }: RailItemProps) {
  return (
    <button
      type="button"
      onClick={inert ? undefined : onClick}
      disabled={inert}
      aria-label={label}
      title={inert ? "Próximamente" : label}
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-[11px] transition",
        active ? "bg-[#EAF1FB] text-[#1F4AA8]" : "text-[#697A93]",
        inert ? "cursor-not-allowed" : "hover:bg-[#EEF3F9]"
      )}
    >
      <Icon size={19} strokeWidth={2} />
      {badge && (
        <span className="absolute right-[6px] top-[5px] h-[9px] w-[9px] rounded-full border-2 border-white bg-[#DC2626]" />
      )}
    </button>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PS";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function FounderShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const whoami = trpc.whoami.useQuery();

  const path = location.pathname;
  const initials = initialsOf(whoami.data?.name ?? "");

  return (
    <CopilotProvider>
      <div className="flex h-dvh w-full bg-white text-[#14254A]">
        <nav className="flex h-full w-16 shrink-0 flex-col items-center gap-[14px] border-r border-[#E5EAF1] bg-white py-[18px]">
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[#1F4AA8] text-white">
            <ShipWheel size={16} strokeWidth={2} />
          </div>
          <div className="h-[10px]" />
          <RailItem
            icon={House}
            label="Feed"
            active={path === "/founder"}
            onClick={() => navigate("/founder")}
          />
          <RailItem icon={TriangleAlert} label="Excepciones" inert badge />
          <RailItem
            icon={Search}
            label="Búsqueda"
            active={path.startsWith("/founder/buscar")}
            onClick={() => navigate("/founder/buscar")}
          />
          <RailItem
            icon={FileText}
            label="Reportes"
            active={path.startsWith("/founder/reportes")}
            onClick={() => navigate("/founder/reportes")}
          />
          <div className="flex-1" />
          <BugReportButton />
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#E9F2FF] text-[12px] font-bold text-[#1F4AA8]">
            {initials}
          </div>
        </nav>

        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-white">
          <Outlet />
        </div>

        <CopilotDockContainer />
      </div>
    </CopilotProvider>
  );
}
