/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Self-contained founder shell — Pencil "Feed en vivo" board (`EzobQ`). A slim
 * dark-on-white icon rail (feed home, exceptions, búsqueda, reportes,
 * profile) on the left, the active screen on the right. Rendered OUTSIDE the
 * operations Layout: an admin on any `/ops` route sees only this chrome.
 *
 * "Exceptions" (issue #109) opens the feed's alerts filter and carries a red
 * badge — lit by `AlertsProvider` polling for newly caught alert-type events,
 * cleared once the alert has been viewed.
 */
import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Clock3,
  FileText,
  House,
  LogOut,
  Monitor,
  Moon,
  Search,
  ShipWheel,
  Sun,
  TriangleAlert
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";
import { trpc } from "../lib/trpc";
import { FeedbackButton } from "../components/FeedbackButton";
import { Tooltip } from "../components/ui/Tooltip";
import { useAuth } from "../context/AuthContext";
import { AlertsProvider, useAlerts } from "./alerts/AlertsContext";
import { useOsAlertNotifications } from "./alerts/osAlertNotifications";
import { CopilotProvider } from "./copilot/CopilotContext";
import { CopilotDockContainer } from "./copilot/CopilotDockContainer";
import { ApplicationPanelProvider } from "./applications/ApplicationPanelContext";
import { useThemeSetting, type ThemeSetting } from "../lib/theme";

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
    <Tooltip label={inert ? "Próximamente" : label}>
      <button
        type="button"
        onClick={inert ? undefined : onClick}
        disabled={inert}
        aria-label={label}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-[11px] transition",
          active ? "bg-ds-subtle text-brand-blue-primary" : "text-ds-muted",
          inert ? "cursor-not-allowed" : "hover:bg-ds-subtle"
        )}
      >
        <Icon size={19} strokeWidth={2} />
        {badge && (
          <span className="absolute right-[6px] top-[5px] h-[9px] w-[9px] rounded-full border-2 border-white bg-ds-red" />
        )}
      </button>
    </Tooltip>
  );
}

/** "Excepciones" rail item — navigates to the feed's alerts filter, badge lit while an alert is unread. */
function ExceptionsRailItem() {
  const navigate = useNavigate();
  const location = useLocation();
  const alerts = useAlerts();

  return (
    <RailItem
      icon={TriangleAlert}
      label="Excepciones"
      active={location.pathname === "/ops" && location.state?.filterId === "alertas"}
      badge={alerts.hasUnread}
      onClick={() => {
        alerts.markSeen();
        navigate("/ops", { state: { filterId: "alertas" } });
      }}
    />
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PS";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

interface ProfileMenuProps {
  initials: string;
  name: string;
}

const THEME_OPTIONS: { value: ThemeSetting; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Sistema", icon: Monitor },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon }
];

/** Sistema / Claro / Oscuro — remembered on this device (lib/theme.ts). */
function ThemeSwitch() {
  const [setting, setSetting] = useThemeSetting();
  return (
    <div className="flex flex-col gap-[6px] px-[10px] py-[8px]">
      <span className="text-[11px] font-semibold tracking-[0.4px] text-ds-muted">TEMA</span>
      <div className="flex rounded-[8px] bg-ds-subtle p-[2px]" role="radiogroup" aria-label="Tema">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={setting === value}
            title={label}
            onClick={() => setSetting(value)}
            data-testid={`theme-${value}`}
            className={`flex flex-1 items-center justify-center gap-[4px] rounded-[6px] py-[5px] text-[11px] font-medium transition ${
              setting === value
                ? "bg-ds-surface text-brand-ink shadow-[0_1px_2px_rgba(20,37,74,0.12)]"
                : "text-ds-muted hover:text-brand-ink"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Rail-bottom avatar — click opens a small menu (name, Tema, Cerrar sesión), closes on outside click. */
function ProfileMenu({ initials, name }: ProfileMenuProps) {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Perfil"
        aria-expanded={open}
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-brand-mist text-[12px] font-bold text-brand-blue-primary transition hover:bg-ds-subtle"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute bottom-0 left-[46px] z-20 flex w-[232px] flex-col gap-[2px] rounded-[12px] border border-ds-border bg-ds-surface p-[6px] shadow-[0_8px_24px_rgba(20,37,74,0.14)]">
          <p className="truncate px-[10px] py-[8px] text-[13px] font-semibold text-brand-ink">
            {name}
          </p>
          <div className="h-px bg-ds-border" />
          <ThemeSwitch />
          <div className="h-px bg-ds-border" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
            className="flex items-center gap-[8px] rounded-[8px] px-[10px] py-[8px] text-left text-[13px] font-medium text-brand-ink transition hover:bg-ds-bg"
          >
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export function FounderShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const whoami = trpc.whoami.useQuery();
  useOsAlertNotifications();

  const path = location.pathname;
  const initials = initialsOf(whoami.data?.name ?? "");
  // Reviewers share the feed (their applications) but not the admin tools:
  // search, tasks, exceptions, reports and the copilot expose non-application data.
  const isAdmin = whoami.data?.roles?.includes("ADMIN") ?? false;

  return (
    <AlertsProvider>
      <CopilotProvider>
        <ApplicationPanelProvider>
          <div className="flex h-dvh w-full bg-ds-surface text-brand-ink">
            <nav className="flex h-full w-16 shrink-0 flex-col items-center gap-[14px] border-r border-t border-ds-border bg-ds-surface py-[18px]">
              <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center text-brand-blue-primary">
                <ShipWheel size={24} strokeWidth={2} />
              </div>
              <div className="h-[10px]" />
              <RailItem
                icon={House}
                label="Feed"
                active={path === "/ops" && location.state?.filterId !== "alertas"}
                onClick={() => navigate("/ops")}
              />
              {isAdmin && (
                <>
                  <RailItem
                    icon={Search}
                    label="Búsqueda"
                    active={path.startsWith("/ops/buscar")}
                    onClick={() => navigate("/ops/buscar")}
                  />
                  <RailItem
                    icon={Clock3}
                    label="Tareas"
                    active={path.startsWith("/ops/tareas")}
                    onClick={() => navigate("/ops/tareas")}
                  />
                  <ExceptionsRailItem />
                  <RailItem
                    icon={FileText}
                    label="Reportes"
                    active={path.startsWith("/ops/reportes")}
                    onClick={() => navigate("/ops/reportes")}
                  />
                </>
              )}
              <div className="flex-1" />
              <FeedbackButton />
              <ProfileMenu initials={initials} name={whoami.data?.name ?? "Ops"} />
            </nav>

            <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden border-t border-ds-border bg-ds-surface">
              <Outlet />
            </div>

            {isAdmin && <CopilotDockContainer />}
          </div>
        </ApplicationPanelProvider>
      </CopilotProvider>
    </AlertsProvider>
  );
}
