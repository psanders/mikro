/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Términos: what the NEW loan looks like. What is owed on the old loan is
 * shown for context and only decides how much leaves the account — it never
 * changes these terms or the contract.
 */
import { useEffect, useMemo, useState } from "react";
import { Save, X } from "lucide-react";
import { renewalNet } from "@mikro/common/schemas";
import { trpc } from "../../lib/trpc";
import { useToast } from "../../components/ui/ToastProvider";
import { formatDop, friendlyError } from "../../lib/applications";
import { PAYMENT_FREQUENCY_LABELS } from "../../lib/customers";
import { Btn, INPUT_CLASS, PanelField, PanelSelect, SectionLabel } from "../applications/ui";
import { Callout } from "./Callout";
import { RenewalSummary } from "./RenewalSummary";
import { canDo, isOpen } from "./helpers";
import type { RenewalViewProps } from "./types";

interface Form {
  principal: string;
  termLength: string;
  paymentFrequency: string;
  paymentAmount: string;
  startingDate: string;
  nickname: string;
}

const dateInput = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

function formOf(r: RenewalViewProps["renewal"]): Form {
  return {
    principal: String(r.terms.principal),
    termLength: String(r.terms.termLength),
    paymentFrequency: r.terms.paymentFrequency,
    paymentAmount: String(r.terms.paymentAmount),
    startingDate: dateInput(r.terms.startingDate),
    nickname: r.terms.nickname ?? ""
  };
}

export function TermsView({ renewal, quote, viewer, refresh, requestCancel }: RenewalViewProps) {
  const toast = useToast();
  const original = useMemo(() => formOf(renewal), [renewal]);
  const [form, setForm] = useState<Form>(original);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setForm(original), [original]);

  const editable = isOpen(renewal.status) && canDo(renewal, viewer, "updateTerms").ok;
  const principal = Number(form.principal);
  const owed = quote?.owed;
  const covered =
    Number.isFinite(principal) && owed != null ? renewalNet(principal, owed) > 0 : true;
  const net = Number.isFinite(principal) && owed != null ? renewalNet(principal, owed) : undefined;
  const dirty = (Object.keys(form) as Array<keyof Form>).some((k) => form[k] !== original[k]);
  const hadContract = Boolean(renewal.contractFilename);

  const update = trpc.updateRenewalTerms.useMutation({
    onSuccess: async () => {
      toast.success(
        hadContract ? "Términos guardados; el contrato se borró." : "Términos guardados."
      );
      setError(null);
      await refresh();
    },
    onError: (e) => setError(friendlyError(e, "No se pudieron guardar los términos."))
  });

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const field = (k: keyof Form, opts: { type?: string; invalid?: boolean } = {}) => (
    <input
      value={form[k]}
      type={opts.type}
      disabled={!editable}
      onChange={(e) => set(k)(e.target.value)}
      data-testid={`renewal-${k}`}
      aria-invalid={opts.invalid || undefined}
      className={INPUT_CLASS + (opts.invalid ? " !border-ds-red text-ds-red" : "")}
    />
  );

  function save() {
    const terms: Record<string, unknown> = {};
    if (form.principal !== original.principal) terms.principal = Number(form.principal);
    if (form.termLength !== original.termLength) terms.termLength = Number(form.termLength);
    if (form.paymentFrequency !== original.paymentFrequency)
      terms.paymentFrequency = form.paymentFrequency;
    if (form.paymentAmount !== original.paymentAmount)
      terms.paymentAmount = Number(form.paymentAmount);
    if (form.startingDate !== original.startingDate && form.startingDate)
      terms.startingDate = new Date(`${form.startingDate}T12:00:00`);
    if (form.nickname !== original.nickname) terms.nickname = form.nickname.trim();
    for (const k of ["principal", "termLength", "paymentAmount"] as const) {
      if (k in terms && !(Number(terms[k]) > 0)) {
        setError("Monto, plazo y cuota deben ser números mayores que cero.");
        return;
      }
    }
    setError(null);
    update.mutate({ id: renewal.id, terms } as never);
  }

  return (
    <div className="flex flex-col gap-[22px]" data-testid="renewal-terms">
      <div className="flex flex-col gap-[12px]">
        <SectionLabel>{`PRÉSTAMO ACTUAL · #${renewal.loan.loanId}`}</SectionLabel>
        <div className="flex gap-3">
          <PanelField label="Saldo">
            <input
              disabled
              className={INPUT_CLASS}
              value={quote ? formatDop(quote.remainingBalance) : "…"}
              readOnly
            />
          </PanelField>
          <PanelField label="Mora">
            <input
              disabled
              className={INPUT_CLASS}
              value={quote ? formatDop(quote.moraAccrued) : "…"}
              readOnly
            />
          </PanelField>
          <PanelField label="Debe hoy">
            <input
              disabled
              className={INPUT_CLASS}
              value={quote ? formatDop(quote.owed) : "…"}
              readOnly
            />
          </PanelField>
        </div>
        <p className="text-[11px] font-medium text-ds-muted">
          Se recalcula en vivo y otra vez al finalizar. Solo cambia cuánto sale de la cuenta, nunca
          el contrato.
        </p>
      </div>

      <div className="flex flex-col gap-[12px]">
        <SectionLabel>NUEVO PRÉSTAMO · TÉRMINOS</SectionLabel>
        <div className="flex gap-3">
          <PanelField label="Monto (RD$)">{field("principal", { invalid: !covered })}</PanelField>
          <PanelField label="Plazo (cuotas)">{field("termLength")}</PanelField>
          <PanelField label="Frecuencia">
            <PanelSelect
              value={form.paymentFrequency}
              disabled={!editable}
              onChange={(e) => set("paymentFrequency")(e.target.value)}
              data-testid="renewal-paymentFrequency"
            >
              {Object.entries(PAYMENT_FREQUENCY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </PanelSelect>
          </PanelField>
        </div>
        <div className="flex gap-3">
          <PanelField label="Cuota (RD$)">{field("paymentAmount")}</PanelField>
          <PanelField label="Inicio">{field("startingDate", { type: "date" })}</PanelField>
          <PanelField label="Apodo del préstamo">{field("nickname")}</PanelField>
        </div>
      </div>

      {!covered && (
        <Callout
          tone="error"
          title="El préstamo nuevo no cubre lo que debe"
          testId="renewal-net-error"
        >
          El préstamo nuevo ({formatDop(principal)}) debe superar lo que debe hoy (
          {formatDop(owed ?? 0)}), o no habría nada que desembolsar. Sube el monto para continuar.
        </Callout>
      )}

      <div className="flex flex-col gap-[10px]">
        <SectionLabel>RESUMEN</SectionLabel>
        <RenewalSummary
          principal={Number.isFinite(principal) ? principal : 0}
          owed={owed}
          net={net}
          done={renewal.status === "COMPLETED"}
        />
      </div>

      <Callout tone="info" title="Qué se registra en contabilidad">
        Solo la diferencia: préstamo nuevo − lo que aún debe el viejo. El préstamo #
        {renewal.loan.loanId} queda «Renovado» al finalizar.
      </Callout>

      {hadContract && editable && (
        <Callout tone="warn" title="Si cambias los términos">
          El contrato se borra y vuelves a Borrador: el firmado tiene que coincidir con los términos
          finales.
        </Callout>
      )}

      {error && (
        <p data-testid="renewal-error" className="text-[12px] font-medium text-ds-red">
          {error}
        </p>
      )}

      {editable && (
        <div className="flex items-center gap-[10px]">
          <Btn
            tone="primary"
            icon={Save}
            disabled={!dirty || !covered || update.isPending}
            onClick={save}
            data-testid="renewal-save-terms"
          >
            Guardar términos
          </Btn>
          <Btn icon={X} onClick={requestCancel} data-testid="renewal-cancel">
            Cancelar renovación
          </Btn>
        </div>
      )}
    </div>
  );
}
