/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Finalizar: the last step. What is owed on the old loan is recomputed live; the
 * user confirms the exact amount that will leave the account, and finalize
 * sends that number. If it moves in the meantime (mora accrues, a payment
 * arrives) the confirmation is withdrawn and the panel says so — the server
 * refuses a stale amount and writes nothing.
 */
import { useState } from "react";
import { Check, Lock, X } from "lucide-react";
import { roundMoney } from "@mikro/common/schemas";
import { trpc } from "../../lib/trpc";
import { useToast } from "../../components/ui/ToastProvider";
import { formatDop, friendlyError } from "../../lib/applications";
import { cn } from "../../lib/cn";
import { Btn, SectionLabel } from "../applications/ui";
import { useApplicationPanel } from "../applications/ApplicationPanelContext";
import { Callout } from "./Callout";
import { RenewalSummary } from "./RenewalSummary";
import { canDo, isOpen } from "./helpers";
import type { RenewalViewProps } from "./types";

function Check_({ done, children }: { done: boolean; children: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] font-medium text-brand-ink">
      <span
        className={cn(
          "flex h-[18px] w-[18px] items-center justify-center rounded-full",
          done ? "bg-ds-green text-white" : "border border-ds-border text-transparent"
        )}
      >
        <Check size={11} strokeWidth={3} />
      </span>
      <span className={done ? "" : "text-ds-muted"}>{children}</span>
    </div>
  );
}

export function FinalizeView({
  renewal,
  quote,
  viewer,
  refresh,
  goTo,
  requestCancel
}: RenewalViewProps) {
  const toast = useToast();
  const panel = useApplicationPanel();
  const loans = trpc.listLoansByCustomer.useQuery(
    { customerId: renewal.customer.id, showAll: true, limit: 100 },
    { enabled: renewal.status === "COMPLETED" }
  );

  // The net the user last accepted, and the net they last looked at.
  const [confirmedNet, setConfirmedNet] = useState<number | null>(null);
  const [seenNet, setSeenNet] = useState<number | null>(renewal.quoted.net);

  const finalize = trpc.finalizeLoanRenewal.useMutation({
    onSuccess: async (res) => {
      toast.success(`Renovación completada: préstamo #${res.newLoan.loanId} creado.`);
      await refresh();
    },
    onError: async (e) => {
      setConfirmedNet(null);
      toast.error(friendlyError(e, "No se pudo finalizar la renovación."));
      await refresh();
    }
  });

  const principal = renewal.terms.principal;
  const net = quote ? roundMoney(quote.net) : undefined;
  const moved = net != null && seenNet != null && roundMoney(seenNet) !== net;
  const checked = confirmedNet != null && net != null && roundMoney(confirmedNet) === net;
  const can = canDo(renewal, viewer, "finalize");
  const ready = renewal.status === "SIGNED" && can.ok && checked && !finalize.isPending;

  if (renewal.status === "COMPLETED") {
    const newLoan = (loans.data ?? []).find((l) => l.id === renewal.newLoanId);
    return (
      <div className="flex flex-col gap-[18px]" data-testid="renewal-done">
        <Callout tone="info" title="Renovación completada">
          {newLoan
            ? `El préstamo #${renewal.loan.loanId} quedó renovado y se creó el préstamo #${newLoan.loanId}.`
            : `El préstamo #${renewal.loan.loanId} quedó renovado.`}{" "}
          Se registró el desembolso de {formatDop(renewal.quoted.net ?? 0)}.
        </Callout>
        <RenewalSummary
          principal={principal}
          owed={renewal.quoted.owed ?? undefined}
          net={renewal.quoted.net ?? undefined}
          done
        />
        <div>
          <Btn onClick={() => panel.openCustomer(renewal.customer.id, "prestamos")}>
            Ver préstamos del cliente
          </Btn>
        </div>
      </div>
    );
  }

  if (renewal.status === "CANCELLED") {
    return (
      <div data-testid="renewal-cancelled">
        <Callout tone="note" title="Renovación cancelada">
          El préstamo #{renewal.loan.loanId} sigue activo; no se movió dinero ni se creó ningún
          préstamo.{renewal.cancelReason ? ` Motivo: ${renewal.cancelReason}.` : ""}
        </Callout>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[22px]" data-testid="renewal-finalize">
      <div className="flex flex-col gap-[10px]">
        <SectionLabel>ANTES DE FINALIZAR</SectionLabel>
        <Check_ done>Términos definidos</Check_>
        <Check_ done={Boolean(renewal.contractFilename)}>Contrato generado</Check_>
        <Check_ done={renewal.status === "SIGNED"}>Contrato firmado u otro documento subido</Check_>
        {renewal.status !== "SIGNED" && (
          <button
            type="button"
            onClick={() => goTo(renewal.contractFilename ? "contrato" : "terminos")}
            className="w-fit text-[12px] font-semibold text-brand-blue-primary hover:underline"
          >
            Completar lo que falta
          </button>
        )}
      </div>

      {moved && (
        <Callout
          tone="warn"
          title="El monto cambió desde que lo viste"
          testId="renewal-net-changed"
        >
          Ahora debe {formatDop(quote!.owed)} y a desembolsar son {formatDop(net!)} (antes{" "}
          {formatDop(seenNet!)}). No se escribió nada: confirma el monto nuevo para continuar.
        </Callout>
      )}

      <div className="flex flex-col gap-[10px]">
        <SectionLabel>
          {moved ? "LO QUE SE VA A REGISTRAR · ACTUALIZADO" : "LO QUE SE VA A REGISTRAR"}
        </SectionLabel>
        <RenewalSummary
          principal={principal}
          owed={quote?.owed}
          net={net}
          previousNet={moved ? (seenNet ?? undefined) : undefined}
        />
      </div>

      <label className="flex items-center gap-[10px] text-[13px] font-semibold text-brand-ink">
        <input
          type="checkbox"
          data-testid="renewal-confirm"
          checked={checked}
          disabled={net == null || renewal.status !== "SIGNED"}
          onChange={(e) => {
            if (e.target.checked && net != null) {
              setConfirmedNet(net);
              setSeenNet(net);
            } else {
              setConfirmedNet(null);
            }
          }}
          className="h-[18px] w-[18px] accent-brand-blue-primary"
        />
        {net != null ? `Confirmo que desembolsaré ${formatDop(net)}` : "Calculando monto…"}
      </label>

      <Callout tone="note" title="Al finalizar">
        El préstamo #{renewal.loan.loanId} pasa a «Renovado», se crea el préstamo nuevo y se
        registra un retiro de {net != null ? formatDop(net) : "…"}. No se puede deshacer desde aquí.
      </Callout>

      {!can.ok && isOpen(renewal.status) && (
        <p className="text-[12px] font-medium text-ds-muted" data-testid="renewal-finalize-blocked">
          {renewal.status === "SIGNED"
            ? "No puedes finalizar esta renovación."
            : "Aún no está lista para finalizar."}
        </p>
      )}

      <div className="flex items-center gap-[10px]">
        <Btn
          tone="success"
          icon={Lock}
          disabled={!ready || net == null}
          onClick={() => net != null && finalize.mutate({ id: renewal.id, confirmedNet: net })}
          data-testid="renewal-finalize-button"
        >
          {moved && checked ? `Confirmar ${formatDop(net!)} y finalizar` : "Finalizar renovación"}
        </Btn>
        <Btn icon={X} onClick={requestCancel} data-testid="renewal-cancel">
          Cancelar renovación
        </Btn>
      </div>
    </div>
  );
}
