/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Register the disbursement (Pencil DvlAW): the loan terms come from the
 * signed contract (read-only), the collector is required, and the source
 * account is one of the accounts configured for disbursements in mikro.json,
 * shown with its live balance. Confirming creates the customer + loan, posts
 * the withdrawal and moves the application to Convertida — one transaction.
 */
import { useMemo, useState } from "react";
import { Landmark, UserRound, UserPlus, Wallet } from "lucide-react";
import { trpc } from "../../../lib/trpc";
import { useToast } from "../../../components/ui/ToastProvider";
import { formatDate, formatDop, friendlyError } from "../../../lib/applications";
import { cn } from "../../../lib/cn";
import { SidePanel } from "../../components/SidePanel";
import {
  contractTermsOf,
  FREQUENCY_LABELS,
  shiftPeriod,
  useApplicationInvalidation,
  type Frequency
} from "../helpers";
import { Btn, INPUT_CLASS, PanelField, SectionLabel } from "../ui";
import type { ViewProps } from "./types";

export function DisburseView({ app, viewer, onView, onClose, panel }: ViewProps) {
  const toast = useToast();
  const invalidate = useApplicationInvalidation();
  const terms = contractTermsOf(app);
  const principal = Number(app.approvedAmount ?? 0);
  const users = trpc.listUsers.useQuery({ limit: 100 });
  const accounts = trpc.listDisbursementAccounts.useQuery();
  const collectors = useMemo(
    () => (users.data ?? []).filter((u) => u.roles?.some((r) => r.role === "COLLECTOR")),
    [users.data]
  );
  const [collectorId, setCollectorId] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const chosenAccount =
    accountId ?? accounts.data?.find((a) => a.isDefault && a.available)?.id ?? null;
  const writable =
    app.status === "APPROVED" && (app.assignedReviewerId === viewer.id || viewer.isAdmin);

  const convert = trpc.convertApplication.useMutation({
    onSuccess: async (r) => {
      toast.success(`Desembolso registrado · préstamo #${r.loanId}. La solicitud pasó a Cerradas.`);
      await invalidate(app.id);
      onClose();
    },
    onError: (e) => toast.error(friendlyError(e, "No se pudo registrar el desembolso."))
  });

  const accountName =
    accounts.data?.find((a) => a.id === chosenAccount)?.name ?? "la cuenta elegida";
  const ready = writable && Boolean(terms) && Boolean(collectorId) && Boolean(chosenAccount);

  function confirm() {
    if (!terms || !chosenAccount) return;
    const firstInstallment = new Date(terms.startDate);
    convert.mutate({
      id: app.id,
      principal,
      termLength: terms.installments,
      paymentAmount: terms.installmentAmount,
      paymentFrequency: terms.frequency,
      // The loan starts one period before its first installment.
      startingDate: shiftPeriod(firstInstallment, terms.frequency as Frequency, -1),
      assignedCollectorId: collectorId,
      accountId: chosenAccount
    });
  }

  const footer = (
    <>
      <span className="flex-1" />
      <Btn onClick={() => onView("detail")}>Cancelar</Btn>
      <Btn
        tone="success"
        disabled={!ready || convert.isPending}
        onClick={confirm}
        data-testid="disburse-confirm"
      >
        Confirmar desembolso
      </Btn>
    </>
  );

  return (
    <SidePanel open {...panel} footer={footer}>
      <div className="flex flex-col gap-[18px]" data-testid="disburse-view">
        {terms ? (
          <div className="grid grid-cols-4 rounded-[10px] bg-[#EEF3F9] px-4 py-3">
            {[
              ["Monto", formatDop(principal)],
              [
                "Cuotas",
                `${terms.installments} ${FREQUENCY_LABELS[terms.frequency].toLowerCase()}s`
              ],
              ["Cuota", formatDop(terms.installmentAmount)],
              ["Primera cuota", formatDate(terms.startDate)]
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-[3px]">
                <span className="text-[11px] font-medium text-[#697A93]">{k}</span>
                <span className="text-[14px] font-semibold text-[#14254A]">{v}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-[10px] bg-[#FDF1E3] px-4 py-3 text-[12.5px] font-medium text-[#D97706]">
            Genera el contrato primero: sus términos son los que se prestan.
            <Btn onClick={() => onView("contract")}>Ir al contrato</Btn>
          </div>
        )}

        <PanelField label="Cobrador asignado">
          <div className="relative">
            <UserRound
              size={15}
              className="pointer-events-none absolute left-3 top-[11px] text-[#697A93]"
            />
            <select
              className={cn(INPUT_CLASS, "pl-9")}
              value={collectorId}
              disabled={!writable}
              onChange={(e) => setCollectorId(e.target.value)}
              data-testid="disburse-collector"
            >
              <option value="">Elige un cobrador</option>
              {collectors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </PanelField>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold text-[#697A93]">Cuenta de origen</span>
          {(accounts.data ?? []).map((a) => {
            const selected = chosenAccount === a.id;
            return (
              <button
                key={a.id}
                type="button"
                disabled={!writable || !a.available}
                onClick={() => setAccountId(a.id)}
                data-testid={`disburse-account-${a.id}`}
                className={cn(
                  "flex items-center gap-3 rounded-[10px] px-[14px] py-3 text-left",
                  selected
                    ? "border-[1.5px] border-[#7C3AED] bg-[#FAF7FF]"
                    : "border border-[#E5EAF1] bg-white",
                  !a.available && "opacity-50"
                )}
              >
                <span
                  className={cn(
                    "h-4 w-4 shrink-0 rounded-full",
                    selected ? "border-[5px] border-[#7C3AED]" : "border-[1.5px] border-[#E5EAF1]"
                  )}
                />
                {a.isDefault ? (
                  <Wallet size={16} className="text-[#697A93]" />
                ) : (
                  <Landmark size={16} className="text-[#697A93]" />
                )}
                <span className="flex flex-1 flex-col">
                  <span className="text-[13px] font-semibold text-[#14254A]">{a.name}</span>
                  <span className="text-[11px] font-medium text-[#697A93]">
                    {!a.available
                      ? "No disponible en contabilidad"
                      : a.isDefault
                        ? "Predeterminada"
                        : "Configurada para desembolsos"}
                  </span>
                </span>
                <span className="text-[13px] font-semibold text-[#697A93]">
                  {a.balance == null ? "—" : formatDop(a.balance)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-[10px] rounded-[10px] bg-[#E8F7EE] px-[14px] py-3 text-[12.5px] font-medium leading-[1.45] text-[#16A34A]">
          <UserPlus size={16} className="mt-[1px] shrink-0" />
          Al confirmar se crea el cliente y el préstamo, se registra el retiro de{" "}
          {formatDop(principal)} en {accountName} y la solicitud pasa a Convertida.
        </div>

        <SectionLabel>Nota</SectionLabel>
        <p className="-mt-3 text-[12px] font-medium text-[#697A93]">
          El comprobante del desembolso se adjunta desde Contabilidad a la transacción creada.
        </p>
      </div>
    </SidePanel>
  );
}
