/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * One card per renewal (Pencil EzobQ sec-12 A), always in its CURRENT state —
 * the events behind it are frozen, the renewal is joined live. The quiet
 * action row follows the status: open it, upload the signed copy, finalize,
 * or look at the outcome. Renovar is never a loud button here. Collapses like
 * the application card.
 */
import { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  CircleX,
  Download,
  FileCheck,
  FileText,
  FolderOpen,
  Lock,
  RefreshCw,
  Upload,
  Wallet,
  X,
  type LucideIcon
} from "lucide-react";
import { formatDop } from "../../lib/applications";
import { PAYMENT_FREQUENCY_LABELS } from "../../lib/customers";
import { cn } from "../../lib/cn";
import { Btn } from "../applications/ui";
import { formatClockTime } from "../components/format";
import { RenewalStatusPill } from "./RenewalStatusPill";
import { renewalTone } from "./status";
import type { RenewalTab } from "./helpers";
import type { RenewalEvent } from "./renewalFeedLayout";

const STATUS_ICON: Record<string, LucideIcon> = {
  DRAFT: RefreshCw,
  CONTRACT_READY: FileText,
  SIGNED: FileCheck,
  COMPLETED: BadgeCheck,
  CANCELLED: CircleX
};

const STEPS = ["Términos", "Contrato", "Firmado", "Finalizada"];
const STEP_REACHED: Record<string, number> = {
  DRAFT: 0,
  CONTRACT_READY: 1,
  SIGNED: 2,
  COMPLETED: 3,
  CANCELLED: -1
};

function sentenceOf(r: RenewalEvent["renewal"], event: RenewalEvent): string {
  switch (r.status) {
    case "DRAFT":
      return "Borrador: ajusta los términos y genera el contrato.";
    case "CONTRACT_READY":
      return "Contrato generado con los términos nuevos. Falta el contrato firmado.";
    case "SIGNED":
      return "Listo para finalizar: revisa el monto y finaliza para cerrar el préstamo viejo y desembolsar.";
    case "COMPLETED":
      return `Préstamo #${r.oldLoanNumber} renovado${r.newLoanNumber ? ` → #${r.newLoanNumber}` : ""}. Se registró el desembolso de ${formatDop(r.quotedNet ?? 0)}.`;
    case "CANCELLED":
      return `Cancelada${r.cancelReason ? ` (${r.cancelReason})` : ""}. El préstamo #${r.oldLoanNumber} sigue activo; no se movió dinero.`;
    default:
      return event.summary;
  }
}

export interface LoanRenewalFeedCardProps {
  event: RenewalEvent;
  /** Open the renewal panel, optionally on a tab or with the cancel confirmation. */
  onOpen: (renewalId: string, opts?: { tab?: RenewalTab; cancel?: boolean }) => void;
  /** Look at the customer's loans (the new loan once completed). */
  onViewLoans: (customerId: string | undefined) => void;
  /** Start a fresh renewal on the same loan (after a cancelled one). */
  onStartAnother: (loanNumber: number) => void;
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  defaultExpanded?: boolean;
  /** Spanish day label shown instead of the clock for pinned older renewals. */
  showDay?: boolean;
  className?: string;
}

export function LoanRenewalFeedCard({
  event,
  onOpen,
  onViewLoans,
  onStartAnother,
  expanded: controlled,
  onToggle,
  defaultExpanded = false,
  showDay,
  className
}: LoanRenewalFeedCardProps) {
  const [internal, setInternal] = useState(defaultExpanded);
  const expanded = controlled ?? internal;
  const setExpanded = (next: boolean) => {
    if (controlled === undefined) setInternal(next);
    onToggle?.(next);
  };
  const r = event.renewal;
  const id = event.renewalId;
  const tone = renewalTone(r.status);
  const Icon = STATUS_ICON[r.status] ?? RefreshCw;
  const reached = STEP_REACHED[r.status] ?? 0;
  const open = r.status === "DRAFT" || r.status === "CONTRACT_READY" || r.status === "SIGNED";
  const cancelled = r.status === "CANCELLED";

  return (
    <div
      data-testid="renewal-card"
      data-status={r.status}
      data-renewal-id={id}
      className={cn(
        "flex flex-col gap-3 border-b border-ds-border px-6",
        expanded ? "pb-4 pt-3" : "py-3",
        cancelled && "opacity-80",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        data-testid="renewal-card-toggle"
        className="flex w-full items-center gap-[14px] text-left"
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]",
            tone.chip
          )}
        >
          <Icon size={17} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="flex items-center gap-[5px] text-[14px] text-brand-ink">
            <span className="font-semibold">{event.actorName}</span>
            <span className="truncate font-medium">
              renueva el préstamo #{r.oldLoanNumber} de {event.customerName ?? "un cliente"}
            </span>
          </span>
          <span className="text-[12px] font-medium text-ds-muted">
            {formatDop(r.principal)} · {r.termLength} × {formatDop(r.paymentAmount)}{" "}
            {(PAYMENT_FREQUENCY_LABELS[r.paymentFrequency] ?? "").toLowerCase()}
          </span>
        </span>
        <span className="flex items-center gap-[10px]">
          <RenewalStatusPill status={r.status} />
          <span className="text-[12px] font-medium text-ds-muted">
            {showDay
              ? new Date(event.occurredAt).toLocaleDateString("es-DO", {
                  day: "numeric",
                  month: "short"
                })
              : formatClockTime(event.occurredAt)}
          </span>
          {expanded ? (
            <ChevronUp size={15} className="text-ds-muted" />
          ) : (
            <ChevronDown size={15} className="text-ds-muted" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 pl-[50px]">
          <p className="text-[13px] font-medium text-brand-ink" data-testid="renewal-card-sentence">
            {sentenceOf(r, event)}
          </p>

          {!cancelled && (
            <div className="flex items-center gap-9">
              {[
                [
                  "Debe hoy",
                  r.quotedOwed != null ? formatDop(r.quotedOwed) : "—",
                  "text-brand-ink"
                ],
                ["Préstamo nuevo", formatDop(r.principal), "text-brand-ink"],
                [
                  r.status === "COMPLETED" ? "Desembolsado" : "A desembolsar",
                  r.quotedNet != null ? formatDop(r.quotedNet) : "—",
                  "text-ds-green"
                ]
              ].map(([k, v, c]) => (
                <div key={k} className="flex flex-col gap-[3px]">
                  <span className="text-[11px] font-medium text-ds-muted">{k}</span>
                  <span className={cn("text-[14px] font-semibold", c)}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {!cancelled && (
            <div className="flex items-center gap-[18px]">
              {STEPS.map((step, i) => (
                <span key={step} className="flex items-center gap-[6px]">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      i <= reached ? "bg-ds-green" : "bg-ds-border"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[12px]",
                      i <= reached ? "font-semibold text-brand-ink" : "font-medium text-ds-muted"
                    )}
                  >
                    {step}
                  </span>
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-[10px]">
            {r.status === "DRAFT" && (
              <Btn
                tone="primary"
                icon={ArrowRight}
                onClick={() => onOpen(id)}
                data-testid="renewal-action-open"
              >
                Abrir renovación
              </Btn>
            )}
            {r.status === "CONTRACT_READY" && (
              <>
                <Btn
                  tone="primary"
                  icon={Upload}
                  onClick={() => onOpen(id, { tab: "contrato" })}
                  data-testid="renewal-action-sign"
                >
                  Subir contrato firmado
                </Btn>
                <Btn icon={Download} onClick={() => onOpen(id, { tab: "contrato" })}>
                  Descargar contrato
                </Btn>
              </>
            )}
            {r.status === "SIGNED" && (
              <>
                <Btn
                  tone="success"
                  icon={Lock}
                  onClick={() => onOpen(id, { tab: "finalizar" })}
                  data-testid="renewal-action-finalize"
                >
                  Finalizar renovación
                </Btn>
                <Btn icon={FolderOpen} onClick={() => onOpen(id, { tab: "documentos" })}>
                  Ver documentos
                </Btn>
              </>
            )}
            {r.status === "COMPLETED" && (
              <Btn
                icon={Wallet}
                onClick={() => onViewLoans(event.customerId)}
                data-testid="renewal-action-loans"
              >
                Ver préstamo nuevo
              </Btn>
            )}
            {cancelled && (
              <Btn
                icon={RefreshCw}
                onClick={() => onStartAnother(r.oldLoanNumber)}
                data-testid="renewal-action-another"
              >
                Iniciar otra renovación
              </Btn>
            )}
            {open && (
              <Btn
                icon={X}
                onClick={() => onOpen(id, { cancel: true })}
                data-testid="renewal-action-cancel"
              >
                Cancelar
              </Btn>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
