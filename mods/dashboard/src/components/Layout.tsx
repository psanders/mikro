/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Inbox, Users, Wallet, Banknote, TrendingUp } from "lucide-react";
import { trpc } from "../lib/trpc";
import { useAuth } from "../context/AuthContext";
import { NavSidebar, type NavItem } from "./ui/NavSidebar";
import { initialsOf } from "./ui/Avatar";

// Nav entries. Only "Inicio" has a screen so far; the rest are present per the
// design but inert until their screens land (follow-on changes).
const ENTRIES: Array<{ icon: NavItem["icon"]; label: string; to?: string }> = [
  { icon: LayoutDashboard, label: "Inicio", to: "/" },
  { icon: Inbox, label: "Solicitudes", to: "/solicitudes" },
  { icon: Users, label: "Clientes", to: "/clientes" },
  { icon: Wallet, label: "Préstamos" },
  { icon: Banknote, label: "Contabilidad", to: "/contabilidad" },
  { icon: TrendingUp, label: "Reportes" }
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  COLLECTOR: "Cobrador",
  REVIEWER: "Revisor"
};

export function Layout() {
  const { userName, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const whoami = trpc.whoami.useQuery();

  const name = whoami.data?.name ?? userName ?? "…";
  const role = whoami.data?.roles?.[0];

  const items: NavItem[] = ENTRIES.map((e) => ({
    icon: e.icon,
    label: e.label,
    active: e.to
      ? e.to === "/"
        ? location.pathname === "/"
        : location.pathname === e.to || location.pathname.startsWith(`${e.to}/`)
      : false,
    onClick: e.to ? () => navigate(e.to!) : undefined
  }));

  return (
    <div className="flex h-full">
      <NavSidebar
        items={items}
        user={{
          name,
          role: role ? (ROLE_LABELS[role] ?? role) : "",
          initials: initialsOf(name === "…" ? "?" : name)
        }}
        onUserClick={() => void logout()}
      />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
