/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { StatusText } from "../components/ui/StatusText";
import { Button } from "../components/ui/Button";
import { SendPromoModal } from "../components/SendPromoModal";
import { useToast } from "../components/ui/ToastProvider";
import { statusMeta, formatDop, isForbidden } from "../lib/applications";
import { MessageCircle } from "lucide-react";

const todaySubtitle = `Resumen de operaciones · ${new Intl.DateTimeFormat("es-DO", {
  weekday: "long",
  day: "numeric",
  month: "short"
}).format(new Date())}`;

// Pencil "Operations / 02 Inicio (Dashboard)" (IDIY8): page header + four KPI
// cards (placeholder) + the recent-requests table, now wired to listApplications.
export function OverviewPage() {
  const navigate = useNavigate();
  const apps = trpc.listApplications.useQuery({ limit: 6 });
  const [promoOpen, setPromoOpen] = useState(false);
  const toast = useToast();

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Inicio"
        subtitle={todaySubtitle}
        action={
          <Button variant="primary" icon={MessageCircle} onClick={() => setPromoOpen(true)}>
            Enviar promoción
          </Button>
        }
      />

      <div className="flex flex-col gap-5 p-7">
        {/* KPIs — placeholder figures pending report procedures */}
        <div className="flex gap-4">
          <StatCard
            label="Cartera total"
            value="RD$ 2.4M"
            delta={{ text: "+11% vs. trimestre" }}
            placeholder
          />
          <StatCard
            label="Solicitudes nuevas"
            value="24"
            delta={{ text: "+12% vs. semana" }}
            placeholder
          />
          <StatCard
            label="Recaudado hoy"
            value="RD$ 84K"
            delta={{ text: "92% de la meta" }}
            placeholder
          />
          <StatCard
            label="Tasa de mora"
            value="4.2%"
            delta={{ text: "-0.6 pts vs. may", down: true }}
            placeholder
          />
        </div>

        {/* Recent applications, wired to listApplications */}
        <div className="overflow-hidden rounded-[14px] border border-ds-border bg-ds-surface">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-[16px] font-medium text-brand-ink">Solicitudes recientes</span>
            <button
              type="button"
              onClick={() => navigate("/solicitudes", { viewTransition: true })}
              className="text-[13px] font-medium text-brand-blue-primary"
            >
              Ver todas
            </button>
          </div>

          <div className="flex items-center gap-[14px] border-y border-ds-border bg-ds-bg px-5 py-[10px] text-[11px] font-bold uppercase tracking-[0.6px] text-ds-muted">
            <span className="flex-1">Solicitante</span>
            <span className="w-[150px]">Monto</span>
            <span className="w-[110px]">Score</span>
            <span className="w-[150px]">Estado</span>
            <span className="w-10" />
          </div>

          {apps.isPending && <div className="px-5 py-6 text-sm text-ds-muted">Cargando…</div>}

          {apps.isError && (
            <div className="px-5 py-6 text-sm text-ds-red" role="alert">
              {isForbidden(apps.error)
                ? "No tienes acceso a las solicitudes."
                : `No se pudieron cargar las solicitudes. ${apps.error.message}`}
            </div>
          )}

          {apps.data?.length === 0 && (
            <div className="px-5 py-6 text-sm text-ds-muted">No hay solicitudes recientes.</div>
          )}

          {apps.data?.map((app, i, arr) => {
            const name = [app.firstName, app.lastName].filter(Boolean).join(" ").trim() || "";
            const st = statusMeta(app.status);
            const last = i === arr.length - 1;
            return (
              <button
                key={app.id}
                type="button"
                onClick={() => navigate(`/solicitudes/${app.id}`, { viewTransition: true })}
                className={`flex w-full items-center gap-[14px] px-5 py-3 text-left hover:bg-ds-subtle ${
                  last ? "" : "border-b border-ds-border"
                }`}
              >
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium text-brand-ink">{name}</span>
                  <span className="text-xs text-ds-muted">{app.businessName ?? ""}</span>
                </div>
                <span className="w-[150px] text-sm font-medium text-brand-ink">
                  {formatDop(app.requestedAmount)}
                </span>
                <span className="w-[110px] text-[13px] text-ds-muted">
                  {app.score != null ? app.score : ""}
                </span>
                <span className="w-[150px]">
                  <StatusText tone={st.tone}>{st.label}</StatusText>
                </span>
                <span className="flex w-10 justify-center">
                  <ChevronRight size={16} className="text-ds-muted" />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {promoOpen && (
        <SendPromoModal
          onClose={() => setPromoOpen(false)}
          onSuccess={(message) => toast.success(message)}
          onError={(message) => toast.error(message)}
        />
      )}
    </div>
  );
}
