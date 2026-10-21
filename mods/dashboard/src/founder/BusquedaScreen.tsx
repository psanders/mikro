/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Universal search for admins and reviewers (`/ops/buscar`) — Pencil "Búsqueda".
 * One input queries `searchAll` (debounced ~300ms) and renders grouped sections
 * (CLIENTES, PRÉSTAMOS, SOLICITUDES ANTERIORES, EN EL FEED). No entity-type
 * picker. "Ver perfil" opens the customer panel; "Renovar" starts (or opens) the
 * renewal; an application opens its panel. The "ask copilot" row is inert and
 * only shown to admins (the copilot is admin-only).
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Search as SearchIcon, Sparkles } from "lucide-react";
import { trpc } from "../lib/trpc";
import { loanStatusMeta } from "../lib/customers";
import { friendlyError, isForbidden, statusMeta } from "../lib/applications";
import { useToast } from "../components/ui/ToastProvider";
import { useCopilot } from "./copilot/CopilotContext";
import { useApplicationPanel } from "./applications/ApplicationPanelContext";
import { useViewer } from "./applications/useViewer";
import { useStartRenewal } from "./renewals/useStartRenewal";
import { SearchResultRow } from "./components/SearchResultRow";
import { FeedEmptyState } from "./components/FeedEmptyState";
import { FeedErrorState } from "./components/FeedErrorState";
import { resolveSubjectLink, subjectQuestion } from "./components/typeConfig";
import { toFeedEvent, type FeedEvent } from "./components/types";

const HINTS = [
  "“pagos borrados esta semana”",
  "“préstamos en mora de Miguel”",
  "“contratos firmados en junio”"
];

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function GroupLabel({ children }: { children: string }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-ds-muted">
      {children}
    </div>
  );
}

export function BusquedaScreen() {
  const copilot = useCopilot();
  const panel = useApplicationPanel();
  const viewer = useViewer();
  const toast = useToast();
  const { startOrFind } = useStartRenewal();
  const isAdmin = viewer?.isAdmin ?? false;
  const [term, setTerm] = useState("");
  const debounced = useDebouncedValue(term.trim(), 300);
  const hasQuery = debounced.length > 0;

  const search = trpc.searchAll.useQuery({ query: debounced }, { enabled: hasQuery });

  const events = useMemo(() => (search.data?.events ?? []).map(toFeedEvent), [search.data]);

  async function renew(loanNumber: number) {
    try {
      const renewal = await startOrFind(loanNumber);
      panel.openRenewal(renewal.id);
    } catch (e) {
      toast.error(friendlyError(e, "No se pudo iniciar la renovación."));
    }
  }

  // A renewal or application opens its panel; anything else asks the copilot
  // about its subject (admins only — reviewers have no copilot).
  function handleEventSelect(event: FeedEvent) {
    if (event.renewalId) {
      panel.openRenewal(event.renewalId);
      return;
    }
    if (event.applicationId && event.type.startsWith("application.")) {
      panel.open(event.applicationId, "detail");
      return;
    }
    if (!isAdmin) return;
    const link = resolveSubjectLink(event);
    if (link) {
      copilot.openWith(subjectQuestion(link.target, event.customerName));
      return;
    }
    if (event.customerName) {
      copilot.openWith(`Muéstrame al cliente ${event.customerName}`);
      return;
    }
    copilot.openWith(`Cuéntame más sobre: ${event.summary}`);
  }

  const customers = search.data?.customers ?? [];
  const loans = search.data?.loans ?? [];
  const applications = search.data?.applications ?? [];
  const noResults =
    hasQuery &&
    search.isSuccess &&
    customers.length === 0 &&
    loans.length === 0 &&
    applications.length === 0 &&
    events.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-col gap-3 border-b border-ds-border px-6 py-[18px]">
        <div className="flex items-center gap-3 rounded-[12px] border-[1.5px] border-brand-blue-primary bg-ds-bg px-4 py-[13px]">
          <SearchIcon size={18} className="shrink-0 text-brand-blue-primary" />
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setTerm("");
            }}
            placeholder="Buscar clientes, préstamos y actividad…"
            className="min-w-0 flex-1 bg-transparent text-[16px] font-medium text-brand-ink placeholder:text-ds-muted focus:outline-none"
          />
          <span className="shrink-0 rounded-[5px] bg-ds-subtle px-[7px] py-[2px] text-[11px] font-semibold text-ds-muted">
            esc
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-medium text-ds-muted">Prueba:</span>
          {HINTS.map((h) => (
            <span
              key={h}
              className="rounded-full bg-ds-subtle px-3 py-[5px] text-[12px] font-medium text-ds-muted"
            >
              {h}
            </span>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-ds-bg px-6 py-[18px]">
        {!hasQuery && (
          <p className="text-[13px] font-medium text-ds-muted">
            Escribe para buscar en clientes, préstamos y el feed.
          </p>
        )}

        {hasQuery && search.isPending && (
          <p className="text-[13px] font-medium text-ds-muted">Buscando…</p>
        )}

        {hasQuery && search.isError && (
          <FeedErrorState
            title="No se pudo buscar"
            description={
              isForbidden(search.error)
                ? "No tienes acceso a la búsqueda."
                : "Verifica tu conexión e inténtalo de nuevo."
            }
            onRetry={() => void search.refetch()}
          />
        )}

        {noResults && (
          <FeedEmptyState
            title="Sin resultados"
            description="No encontramos clientes, préstamos, solicitudes ni eventos para esa búsqueda."
          />
        )}

        {hasQuery && search.isSuccess && !noResults && (
          <div className="flex flex-col gap-[18px]">
            {customers.length > 0 && (
              <div className="flex flex-col gap-[12px]">
                <GroupLabel>{`CLIENTES · ${customers.length}`}</GroupLabel>
                {customers.map((c) => (
                  <SearchResultRow
                    key={c.id}
                    variant="cliente"
                    name={c.name}
                    phone={c.phone || undefined}
                    idNumber={c.idNumber || undefined}
                    onSelect={() => panel.openCustomer(c.id)}
                  />
                ))}
              </div>
            )}

            {loans.length > 0 && (
              <div className="flex flex-col gap-[12px]">
                <GroupLabel>{`PRÉSTAMOS · ${loans.length}`}</GroupLabel>
                {loans.map((l) => {
                  const meta = loanStatusMeta(l.status);
                  return (
                    <SearchResultRow
                      key={l.id}
                      variant="prestamo"
                      loanNumber={l.loanId}
                      customerName={l.customerName ?? ""}
                      statusLabel={meta.label}
                      statusTone={meta.tone}
                      onSelect={() => panel.openCustomer(l.customerId, "prestamos")}
                      onRenew={l.status === "ACTIVE" ? () => void renew(l.loanId) : undefined}
                    />
                  );
                })}
              </div>
            )}

            {applications.length > 0 && (
              <div className="flex flex-col gap-[12px]">
                <GroupLabel>{`SOLICITUDES ANTERIORES · ${applications.length}`}</GroupLabel>
                {applications.map((a) => {
                  const meta = statusMeta(a.status);
                  return (
                    <SearchResultRow
                      key={a.id}
                      variant="solicitud"
                      name={[a.firstName, a.lastName].filter(Boolean).join(" ") || "Solicitud"}
                      businessName={a.businessName ?? undefined}
                      statusLabel={meta.label}
                      statusTone={
                        meta.tone === "green" ? "green" : meta.tone === "red" ? "red" : "neutral"
                      }
                      meta={[
                        a.phone,
                        a.idNumber && `Cédula ${a.idNumber}`,
                        new Date(a.createdAt).toLocaleDateString("es-DO", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        })
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      onSelect={() => panel.open(a.id, "detail")}
                    />
                  );
                })}
              </div>
            )}

            {events.length > 0 && (
              <div className="flex flex-col gap-[12px]">
                <GroupLabel>{`EN EL FEED · ${events.length}`}</GroupLabel>
                <div className="overflow-hidden rounded-[14px] border border-ds-border bg-ds-surface">
                  {events.map((event, i) => (
                    <SearchResultRow
                      key={event.id}
                      variant="evento"
                      event={event}
                      divider={i > 0}
                      onSelect={() => handleEventSelect(event)}
                    />
                  ))}
                </div>
              </div>
            )}

            {isAdmin && (
              <div
                title="Próximamente"
                aria-disabled="true"
                className="flex cursor-not-allowed items-center gap-[10px] rounded-[12px] bg-brand-mist px-4 py-[13px]"
              >
                <Sparkles size={16} className="shrink-0 text-brand-blue-primary" />
                <span className="flex-1 text-[13px] font-semibold text-brand-blue-primary">
                  {`Preguntar al copiloto: «¿Cómo va ${debounced}?»`}
                </span>
                <ArrowRight size={15} className="shrink-0 text-brand-blue-primary" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
