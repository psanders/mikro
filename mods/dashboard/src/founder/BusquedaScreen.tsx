/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Universal admin search (`/ops/buscar`) — Pencil "Búsqueda". One input
 * queries `searchAll` (debounced ~300ms) and renders three grouped sections
 * (CLIENTES, PRÉSTAMOS, EN EL FEED). No entity-type picker. The "ask copilot"
 * row is inert (a later change owns the copilot).
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Search as SearchIcon, Sparkles } from "lucide-react";
import { trpc, type RouterOutputs } from "../lib/trpc";
import { loanStatusMeta } from "../lib/customers";
import { isForbidden } from "../lib/applications";
import { useCopilot } from "./copilot/CopilotContext";
import { SearchResultRow } from "./components/SearchResultRow";
import { FeedEmptyState } from "./components/FeedEmptyState";
import { FeedErrorState } from "./components/FeedErrorState";
import { resolveSubjectLink, subjectQuestion } from "./components/typeConfig";
import type { FeedEvent } from "./components/types";

type SearchEventItem = RouterOutputs["searchAll"]["events"][number];

const HINTS = [
  "“pagos borrados esta semana”",
  "“préstamos en mora de Miguel”",
  "“contratos firmados en junio”"
];

function toFeedEvent(item: SearchEventItem): FeedEvent {
  return {
    id: item.id,
    type: item.type as FeedEvent["type"],
    occurredAt: new Date(item.occurredAt).toISOString(),
    actorName: item.actorName,
    customerName: item.customerName ?? undefined,
    loanId: item.loanId ?? undefined,
    loanNumber: item.loanNumber ?? undefined,
    applicationId: item.applicationId ?? undefined,
    amount: item.amount ?? undefined,
    summary: item.summary,
    payload: (item.payload ?? {}) as Record<string, unknown>
  };
}

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
  const [term, setTerm] = useState("");
  const debounced = useDebouncedValue(term.trim(), 300);
  const hasQuery = debounced.length > 0;

  const search = trpc.searchAll.useQuery({ query: debounced }, { enabled: hasQuery });

  const events = useMemo(() => {
    const raw = search.data?.events ?? [];
    return raw.map(toFeedEvent);
  }, [search.data]);

  // Retired ops detail pages no longer exist: selecting an event opens the
  // copilot dock prefilled with a question about its subject instead of
  // navigating there.
  function handleEventSelect(event: FeedEvent) {
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
  const noResults =
    hasQuery &&
    search.isSuccess &&
    customers.length === 0 &&
    loans.length === 0 &&
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
            description="No encontramos clientes, préstamos ni eventos para esa búsqueda."
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
                    onSelect={() => copilot.openWith(`Muéstrame al cliente ${c.name}`)}
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
                      onSelect={() =>
                        copilot.openWith(`Muéstrame los detalles del préstamo ${l.loanId}`)
                      }
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
          </div>
        )}
      </div>
    </div>
  );
}
