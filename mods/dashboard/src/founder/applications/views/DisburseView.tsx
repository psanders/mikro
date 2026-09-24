/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Register the disbursement (Pencil DvlAW): the loan terms come from the
 * signed contract (read-only), the collector is required, and the source
 * account is one of the accounts configured for disbursements in mikro.json,
 * shown with its live balance. Confirming creates the customer + loan, posts
 * the withdrawal and moves the application to Convertida — one transaction.
 *
 * A contract signed before this flow (a migrated SIGNED application) has no
 * stored terms, so the operator types them from the signed paper — as the old
 * flow did — plus the amount when the old form never recorded one.
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
  INSTALLMENT_PLURAL,
  shiftPeriod,
  toDateInput,
  todayDate,
  useApplicationInvalidation,
  type Frequency
} from "../helpers";
import { Btn, INPUT_CLASS, PanelField, SectionLabel } from "../ui";
import type { ViewProps } from "./types";

export function DisburseView({ app, viewer, onView, onClose, panel }: ViewProps) {
  const toast = useToast();
  const invalidate = useApplicationInvalidation();
  const stored = contractTermsOf(app);
  const legacy = !stored && Boolean(app.contractFilename);
  const approved = app.approvedAmount == null ? null : Number(app.approvedAmount);
  const [manual, setManual] = useState(() => ({
    principal: approved == null ? "" : String(approved),
    installments: app.approvedTermWeeks == null ? "" : String(app.approvedTermWeeks),
    installmentAmount: "",
    frequency: "WEEKLY" as Frequency,
    startDate: toDateInput(shiftPeriod(todayDate(), "WEEKLY", 1))
  }));
  const manualTerms =
    legacy &&
    Number(manual.installments) > 0 &&
    Number(manual.installmentAmount) > 0 &&
    manual.startDate
      ? {
          installments: Number(manual.installments),
          installmentAmount: Number(manual.installmentAmount),
          frequency: manual.frequency,
          startDate: manual.startDate
        }
      : null;
  const terms = stored ?? manualTerms;
  const principal = approved ?? Number(manual.principal || 0);
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
  const ready =
    writable && Boolean(terms) && principal > 0 && Boolean(collectorId) && Boolean(chosenAccount);

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
        {legacy ? (
          <LegacyTerms
            value={manual}
            onChange={setManual}
            amountLocked={approved != null}
            disabled={!writable}
          />
        ) : terms ? (
          <div className="grid grid-cols-4 rounded-[10px] bg-[#EEF3F9] px-4 py-3">
            {[
              ["Monto", formatDop(principal)],
              [
                "Cuotas",
                `${terms.installments} ${INSTALLMENT_PLURAL[terms.frequency as Frequency]}`
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

interface ManualTerms {
  principal: string;
  installments: string;
  installmentAmount: string;
  frequency: Frequency;
  startDate: string;
}

/** Terms typed from a contract signed before this flow (it stored none). */
function LegacyTerms({
  value,
  onChange,
  amountLocked,
  disabled
}: {
  value: ManualTerms;
  onChange: (v: ManualTerms) => void;
  amountLocked: boolean;
  disabled: boolean;
}) {
  const set = (patch: Partial<ManualTerms>) => onChange({ ...value, ...patch });
  const digits = (v: string) => v.replace(/[^\d.]/g, "");
  return (
    <div className="flex flex-col gap-3" data-testid="disburse-legacy-terms">
      <div className="rounded-[10px] bg-[#FDF1E3] px-4 py-3 text-[12.5px] font-medium text-[#D97706]">
        Contrato firmado antes del nuevo flujo: copia los términos tal como aparecen en el contrato
        firmado.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <PanelField label="Monto del préstamo (RD$)">
          <input
            className={INPUT_CLASS}
            inputMode="decimal"
            value={value.principal}
            disabled={disabled || amountLocked}
            onChange={(e) => set({ principal: digits(e.target.value) })}
            data-testid="disburse-legacy-principal"
          />
        </PanelField>
        <PanelField label="Cuotas">
          <input
            className={INPUT_CLASS}
            inputMode="numeric"
            value={value.installments}
            disabled={disabled}
            onChange={(e) => set({ installments: e.target.value.replace(/\D/g, "") })}
            data-testid="disburse-legacy-installments"
          />
        </PanelField>
        <PanelField label="Monto de cada cuota (RD$)">
          <input
            className={INPUT_CLASS}
            inputMode="decimal"
            value={value.installmentAmount}
            disabled={disabled}
            onChange={(e) => set({ installmentAmount: digits(e.target.value) })}
            data-testid="disburse-legacy-installment-amount"
          />
        </PanelField>
        <PanelField label="Frecuencia">
          <select
            className={INPUT_CLASS}
            value={value.frequency}
            disabled={disabled}
            onChange={(e) => {
              const f = e.target.value as Frequency;
              set({ frequency: f, startDate: toDateInput(shiftPeriod(todayDate(), f, 1)) });
            }}
          >
            {(Object.keys(FREQUENCY_LABELS) as Frequency[]).map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        </PanelField>
        <PanelField label="Primera cuota">
          <input
            type="date"
            className={INPUT_CLASS}
            value={value.startDate}
            disabled={disabled}
            onChange={(e) => set({ startDate: e.target.value })}
          />
        </PanelField>
      </div>
    </div>
  );
}
