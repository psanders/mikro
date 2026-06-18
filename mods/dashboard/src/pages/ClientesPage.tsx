/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { trpc } from "../lib/trpc";
import { PageHeader } from "../components/ui/PageHeader";
import { Search } from "../components/ui/Search";
import { Tab } from "../components/ui/Tab";
import { StatusText } from "../components/ui/StatusText";
import { Avatar, initialsOf } from "../components/ui/Avatar";
import { CUSTOMER_SEGMENTS, segmentToShowInactive, type CustomerSegment } from "../lib/customers";

const PAGE_SIZE = 20;

// Pencil "Operations / 05 Clientes" (wu59x): toolbar (active/inactive segments +
// server-side search) over a table of customers wired to listCustomers. Columns
// are limited to the fields listCustomers actually returns on the Customer model
// (no relation includes — collector/referrer come back as IDs only, so they are
// intentionally not shown).
export function ClientesPage() {
  const navigate = useNavigate();
  const [segment, setSegment] = useState<CustomerSegment>(
    () => (sessionStorage.getItem("clientes.segment") as CustomerSegment | null) ?? "active"
  );
  const [search, setSearch] = useState(() => sessionStorage.getItem("clientes.q") ?? "");
  const [limit, setLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    sessionStorage.setItem("clientes.segment", segment);
  }, [segment]);
  useEffect(() => {
    sessionStorage.setItem("clientes.q", search);
  }, [search]);

  // The procedure requires a 2-char minimum for search; only send it past that.
  const term = search.trim();
  const customers = trpc.listCustomers.useQuery({
    search: term.length >= 2 ? term : undefined,
    showInactive: segmentToShowInactive(segment),
    limit
  });

  const rows = customers.data ?? [];
  const subtitle =
    customers.data != null
      ? `Cartera de clientes · ${rows.length} mostrados`
      : "Cartera de clientes";

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Clientes" subtitle={subtitle} />

      <div className="flex flex-col gap-4 p-7">
        {/* Toolbar: segment tabs + search */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {CUSTOMER_SEGMENTS.map((t) => (
              <Tab
                key={t.value}
                active={segment === t.value}
                onClick={() => {
                  setSegment(t.value);
                  setLimit(PAGE_SIZE);
                }}
              >
                {t.label}
              </Tab>
            ))}
          </div>
          <Search
            placeholder="Buscar por nombre, apodo o teléfono…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[300px]"
          />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-[14px] border border-ds-border bg-ds-surface">
          {/* Header */}
          <div className="flex items-center gap-[14px] border-b border-ds-border bg-ds-bg px-5 py-[11px] text-xs font-medium uppercase tracking-[0.3px] text-ds-muted">
            <span className="flex-1">Cliente</span>
            <span className="w-[150px]">Cédula</span>
            <span className="w-[150px]">Teléfono</span>
            <span className="flex-1">Dirección</span>
            <span className="w-[110px]">Estado</span>
            <span className="w-9" />
          </div>

          {customers.isPending && <div className="px-5 py-6 text-sm text-ds-muted">Cargando…</div>}

          {customers.isError && (
            <div className="px-5 py-6 text-sm text-ds-red" role="alert">
              No se pudieron cargar los clientes. {customers.error.message}
            </div>
          )}

          {customers.data && rows.length === 0 && (
            <div className="px-5 py-6 text-sm text-ds-muted">
              {term.length >= 2
                ? "No hay clientes para esta búsqueda."
                : "No hay clientes para este filtro."}
            </div>
          )}

          {rows.map((c, i) => {
            const last = i === rows.length - 1;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(`/clientes/${c.id}`, { viewTransition: true })}
                className={`flex w-full items-center gap-[14px] px-5 py-3 text-left hover:bg-ds-subtle ${
                  last ? "" : "border-b border-ds-border"
                }`}
              >
                <div className="flex flex-1 items-center gap-[11px]">
                  <Avatar initials={initialsOf(c.name)} />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-brand-ink">{c.name}</span>
                    {c.nickname && <span className="text-xs text-ds-muted">{c.nickname}</span>}
                  </div>
                </div>
                <span className="w-[150px] text-[13px] text-ds-muted">{c.idNumber || ""}</span>
                <span className="w-[150px] text-[13px] text-brand-ink">{c.phone || ""}</span>
                <span className="flex-1 truncate text-[13px] text-ds-muted">
                  {c.homeAddress || ""}
                </span>
                <span className="w-[110px]">
                  <StatusText tone="neutral">{c.isActive ? "Activo" : "Inactivo"}</StatusText>
                </span>
                <span className="flex w-9 justify-center">
                  <ChevronRight size={16} className="text-ds-muted" />
                </span>
              </button>
            );
          })}
        </div>

        {/* Load more */}
        {customers.data && rows.length >= limit && (
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
