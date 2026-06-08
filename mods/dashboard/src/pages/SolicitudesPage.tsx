/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { trpc } from "../lib/trpc";
import { PageHeader } from "../components/ui/PageHeader";
import { Search } from "../components/ui/Search";
import { Tab } from "../components/ui/Tab";
import { Button } from "../components/ui/Button";
import { StatusText } from "../components/ui/StatusText";
import {
  STATUS_TABS,
  DEFAULT_STATUS,
  statusMeta,
  formatDop,
  isForbidden,
  type ApplicationStatus
} from "../lib/applications";

const PAGE_SIZE = 20;

// Pencil "Operations / 03 Solicitudes (Bandeja)" (Jnc0R): toolbar (status tabs +
// search) over a table of applications wired to listApplications.
export function SolicitudesPage() {
  const navigate = useNavigate();
  // Remember the chosen filter for the session, so returning from a detail
  // restores the same view. (Migrate any legacy "all" value — the Todas tab was
  // removed — to the default lifecycle tab.)
  const [status, setStatus] = useState<ApplicationStatus>(() => {
    const saved = sessionStorage.getItem("solicitudes.status") as ApplicationStatus | "all" | null;
    return saved && saved !== "all" ? saved : DEFAULT_STATUS;
  });
  const [search, setSearch] = useState(() => sessionStorage.getItem("solicitudes.q") ?? "");
  const [limit, setLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    sessionStorage.setItem("solicitudes.status", status);
  }, [status]);
  useEffect(() => {
    sessionStorage.setItem("solicitudes.q", search);
  }, [search]);

  const apps = trpc.listApplications.useQuery({ status, limit });

  // Resolve evaluator (reviewedById) names for the EVALUADOR column.
  const users = trpc.listUsers.useQuery({});
  const userName = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users.data ?? []) map.set(u.id, u.name);
    return map;
  }, [users.data]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = apps.data ?? [];
    if (!term) return list;
    return list.filter((a) =>
      [a.firstName, a.lastName, a.businessName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [apps.data, search]);

  const subtitle =
    apps.data != null
      ? `Bandeja de evaluación · ${apps.data.length} solicitudes`
      : "Bandeja de evaluación";

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Solicitudes" subtitle={subtitle} />

      <div className="flex flex-col gap-4 p-7">
        {/* Toolbar: status tabs + search */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {STATUS_TABS.map((t) => (
              <Tab
                key={t.label}
                active={status === t.value}
                onClick={() => {
                  setStatus(t.value);
                  setLimit(PAGE_SIZE);
                }}
              >
                {t.label}
              </Tab>
            ))}
          </div>
          <div className="flex items-center gap-[10px]">
            <Search
              placeholder="Buscar solicitud o cliente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[300px]"
            />
            {/* Filtros — visual placeholder; advanced filtering lands later. */}
            <Button variant="secondary" icon={SlidersHorizontal} disabled title="Próximamente">
              Filtros
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-[14px] border border-ds-border bg-ds-surface">
          {/* Header */}
          <div className="flex items-center gap-[14px] border-b border-ds-border bg-ds-bg px-5 py-[11px] text-xs font-medium uppercase tracking-[0.3px] text-ds-muted">
            <span className="w-[140px]">Solicitud</span>
            <span className="flex-1">Cliente</span>
            <span className="w-[130px]">Monto</span>
            <span className="w-20">Score</span>
            <span className="w-[160px]">Evaluador</span>
            <span className="w-[150px]">Estado</span>
            <span className="w-9" />
          </div>

          {apps.isPending && <div className="px-5 py-6 text-sm text-ds-muted">Cargando…</div>}

          {apps.isError && (
            <div className="px-5 py-6 text-sm text-ds-red" role="alert">
              {isForbidden(apps.error)
                ? "No tienes acceso a las solicitudes. Pide a un administrador el rol de revisor."
                : `No se pudieron cargar las solicitudes. ${apps.error.message}`}
            </div>
          )}

          {apps.data && rows.length === 0 && (
            <div className="px-5 py-6 text-sm text-ds-muted">
              No hay solicitudes para este filtro.
            </div>
          )}

          {rows.map((a, i) => {
            const name = [a.firstName, a.lastName].filter(Boolean).join(" ").trim() || "—";
            const st = statusMeta(a.status);
            const last = i === rows.length - 1;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => navigate(`/solicitudes/${a.id}`, { viewTransition: true })}
                className={`flex w-full items-center gap-[14px] px-5 py-3 text-left hover:bg-ds-subtle ${
                  last ? "" : "border-b border-ds-border"
                }`}
              >
                <div className="flex w-[140px] flex-col gap-px">
                  <span className="text-[13px] font-medium text-brand-ink">
                    #{a.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span className="text-[11px] font-medium text-ds-muted">
                    {new Intl.DateTimeFormat("es-DO", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit"
                    }).format(new Date(a.createdAt))}
                  </span>
                </div>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium text-brand-ink">{name}</span>
                  <span className="text-xs text-ds-muted">{a.businessName ?? "—"}</span>
                </div>
                <span className="w-[130px] text-sm font-medium text-brand-ink">
                  {formatDop(a.requestedAmount)}
                </span>
                <span className="w-20 text-sm font-medium text-brand-ink">
                  {a.score != null ? a.score : "—"}
                </span>
                <span className="w-[160px] text-[13px] text-ds-muted">
                  {a.reviewedById ? (userName.get(a.reviewedById) ?? "Asignado") : "Sin asignar"}
                </span>
                <span className="w-[150px]">
                  <StatusText tone={st.tone} className="text-[12px]">
                    {st.label}
                  </StatusText>
                </span>
                <span className="flex w-9 justify-center">
                  <ChevronRight size={16} className="text-ds-muted" />
                </span>
              </button>
            );
          })}
        </div>

        {/* Load more */}
        {apps.data && apps.data.length >= limit && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE_SIZE)}
              className="rounded-[10px] border border-ds-border bg-ds-surface px-5 py-2 text-[13px] font-medium text-brand-ink hover:bg-ds-subtle"
            >
              Cargar más
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
