/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The renewal side panel (Pencil EzobQ sec-12 C). This first version shows the
 * renewal read-only: where it stands, what is owed on the old loan today, the
 * proposed terms and the net that would leave the account. The actions (edit
 * terms, contract, signed copy, finalize, cancel) arrive with the next change.
 */
import { RefreshCw } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { formatDop } from "../../lib/applications";
import { SidePanel } from "../components/SidePanel";
import { SectionLabel } from "../applications/ui";
import { RenewalStatusPill } from "./RenewalStatusPill";
import { renewalTone } from "./status";

const FREQUENCY: Record<string, string> = {
  DAILY: "diaria",
  WEEKLY: "semanal",
  BIWEEKLY: "quincenal",
  MONTHLY: "mensual"
};

function Kv({ k, v, testId }: { k: string; v: string; testId?: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
      <span className="text-[11px] font-medium text-ds-muted">{k}</span>
      <span data-testid={testId} className="text-[14px] font-semibold text-brand-ink">
        {v}
      </span>
    </div>
  );
}

export function RenewalPanel({ renewalId, onClose }: { renewalId: string; onClose: () => void }) {
  const renewal = trpc.getLoanRenewal.useQuery({ id: renewalId });
  const quote = trpc.getLoanRenewalQuote.useQuery({ id: renewalId });
  const r = renewal.data;
  const q = quote.data;

  return (
    <SidePanel
      open
      onClose={onClose}
      testId="renewal-panel"
      icon={RefreshCw}
      iconClassName={renewalTone(r?.status ?? "DRAFT").chip}
      title={r ? `Renovar préstamo #${r.loan.loanId}` : "Renovar préstamo"}
      subtitle={r?.customer.name}
      headerExtra={r ? <RenewalStatusPill status={r.status} /> : undefined}
    >
      {renewal.isError && (
        <p className="text-[13px] font-medium text-ds-red">
          {renewal.error.message || "No se pudo cargar la renovación."}
        </p>
      )}
      {r && (
        <div className="flex flex-col gap-[22px]">
          <div className="flex flex-col gap-[12px]">
            <SectionLabel>PRÉSTAMO ACTUAL · #{r.loan.loanId}</SectionLabel>
            <div className="flex gap-[16px]">
              <Kv k="Saldo" v={q ? formatDop(q.remainingBalance) : "…"} />
              <Kv k="Mora" v={q ? formatDop(q.moraAccrued) : "…"} />
              <Kv k="Debe hoy" v={q ? formatDop(q.owed) : "…"} testId="renewal-owed" />
            </div>
            <p className="text-[11px] font-medium text-ds-muted">
              Se recalcula en vivo y otra vez al finalizar. Solo cambia cuánto sale de la cuenta,
              nunca el contrato.
            </p>
          </div>

          <div className="flex flex-col gap-[12px]">
            <SectionLabel>NUEVO PRÉSTAMO · TÉRMINOS</SectionLabel>
            <div className="flex gap-[16px]">
              <Kv k="Monto" v={formatDop(r.terms.principal)} testId="renewal-principal" />
              <Kv k="Plazo" v={`${r.terms.termLength} cuotas`} />
              <Kv k="Cuota" v={formatDop(r.terms.paymentAmount)} />
              <Kv
                k="Frecuencia"
                v={FREQUENCY[r.terms.paymentFrequency] ?? r.terms.paymentFrequency}
              />
            </div>
          </div>

          <div className="flex flex-col gap-[10px] rounded-[12px] bg-ds-subtle p-[16px]">
            <div className="flex items-center justify-between text-[13px] font-medium text-ds-muted">
              <span>Préstamo nuevo</span>
              <span className="font-semibold text-brand-ink">{formatDop(r.terms.principal)}</span>
            </div>
            <div className="flex items-center justify-between text-[13px] font-medium text-ds-muted">
              <span>Debe hoy (préstamo #{r.loan.loanId})</span>
              <span className="font-semibold text-brand-ink">{q ? formatDop(q.owed) : "…"}</span>
            </div>
            <div className="h-px bg-ds-border" />
            <div className="flex items-center justify-between text-[13px] font-semibold text-brand-ink">
              <span>A desembolsar (sale de la cuenta)</span>
              <span data-testid="renewal-net" className="text-[18px] font-bold text-ds-green">
                {q ? formatDop(q.net) : "…"}
              </span>
            </div>
          </div>
        </div>
      )}
    </SidePanel>
  );
}
