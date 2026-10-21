/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The copilot's renewal card (openspec add-loan-renewal). Renewing is a process
 * with its own panel, so the card only gets it going: it takes the loan number
 * (pre-filled when the founder named one), starts the renewal — or opens the
 * one already in progress — and hands over to the renewal panel. Presentational:
 * the container owns the mutation.
 */
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, RefreshCw, Search } from "lucide-react";
import { cn } from "../../lib/cn";
import { RenewalStatusPill } from "../renewals/RenewalStatusPill";

export type RenewalStartStatus = "idle" | "starting" | "started" | "error";

export interface RenewalStartCardProps {
  /** Loan number the founder named, to pre-fill the field. */
  loanId?: number;
  status?: RenewalStartStatus;
  error?: string;
  /** Set once started: the renewal the panel opens on. */
  started?: { renewalId: string; status: string; loanNumber: number; customerName: string };
  onStart: (loanNumber: number) => void;
  onOpen: (renewalId: string) => void;
  className?: string;
}

export function RenewalStartCard({
  loanId,
  status = "idle",
  error,
  started,
  onStart,
  onOpen,
  className
}: RenewalStartCardProps) {
  const [query, setQuery] = useState(loanId ? String(loanId) : "");
  useEffect(() => {
    if (loanId) setQuery(String(loanId));
  }, [loanId]);

  const loanNumber = Number(query.trim().replace(/^#/, ""));
  const valid = Number.isInteger(loanNumber) && loanNumber > 0;
  const busy = status === "starting";

  return (
    <div
      data-testid="renewal-start-card"
      className={cn(
        "w-full overflow-hidden rounded-[12px] border border-ds-border bg-ds-surface",
        className
      )}
    >
      <div className="flex items-center gap-[10px] border-b border-ds-border bg-ds-subtle px-[14px] py-[11px]">
        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] bg-brand-blue-primary">
          <RefreshCw size={14} strokeWidth={2} className="text-white" />
        </span>
        <div className="flex min-w-0 flex-col gap-[1px]">
          <span className="text-[14px] font-semibold text-brand-ink">Renovar préstamo</span>
          <span className="text-[11px] font-medium text-ds-muted">
            Se revisa en el panel: términos, contrato, firmado y desembolso
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-[10px] px-[14px] py-[12px]">
        {started ? (
          <div className="flex items-center gap-[10px]">
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="truncate text-[14px] font-medium text-brand-ink">
                {started.customerName} · préstamo #{started.loanNumber}
              </span>
              <span>
                <RenewalStatusPill status={started.status} />
              </span>
            </div>
            <button
              type="button"
              data-testid="renewal-card-open"
              onClick={() => onOpen(started.renewalId)}
              className="inline-flex items-center gap-[7px] rounded-[9px] border border-ds-border bg-ds-surface px-4 py-[9px] text-[14px] font-medium text-brand-ink hover:bg-ds-bg"
            >
              Abrir renovación
              <ArrowRight size={15} />
            </button>
          </div>
        ) : (
          <>
            <span className="text-[12px] font-medium text-ds-muted">Préstamo a renovar</span>
            <div className="flex gap-[8px]">
              <div className="flex flex-1 items-center gap-[10px] rounded-[8px] border border-ds-border bg-ds-bg px-[14px] py-[10px]">
                <Search size={16} strokeWidth={2} className="shrink-0 text-ds-muted" />
                <input
                  inputMode="numeric"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && valid && !busy && onStart(loanNumber)}
                  placeholder="Número de préstamo, p. ej. 10034"
                  className="w-full bg-transparent text-[14px] font-medium text-brand-ink outline-none placeholder:text-ds-muted"
                />
              </div>
              <button
                type="button"
                data-testid="renewal-card-start"
                disabled={!valid || busy}
                onClick={() => onStart(loanNumber)}
                className="inline-flex items-center gap-[7px] rounded-[9px] border border-ds-border bg-ds-surface px-4 py-[9px] text-[14px] font-medium text-brand-ink hover:bg-ds-bg disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : "Abrir renovación"}
              </button>
            </div>
            {status === "error" && error && (
              <p className="text-[12px] font-medium text-ds-red">{error}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
