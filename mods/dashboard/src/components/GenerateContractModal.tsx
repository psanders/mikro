/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Post-approval "Generar contrato": the reviewer supplies the negotiated terms
 * + debtor gender; the server renders the contract PDF, which downloads here.
 */
import { useState } from "react";
import { FileDown, X } from "lucide-react";
import { trpc } from "../lib/trpc";
import { saveFile } from "../lib/saveFile";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";

type Frequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

interface Props {
  id: string;
  defaultInstallments?: number | null;
  onClose: () => void;
}

export function GenerateContractModal({ id, defaultInstallments, onClose }: Props) {
  const [gender, setGender] = useState<"M" | "F">("F");
  const [installments, setInstallments] = useState(String(defaultInstallments || ""));
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("WEEKLY");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  const generate = trpc.generateApplicationContract.useMutation({
    onSuccess: async (r) => {
      const bytes = Uint8Array.from(atob(r.dataBase64), (c) => c.charCodeAt(0));
      await saveFile(bytes, r.filename, "application/pdf");
      onClose();
    }
  });

  const valid = Number(installments) > 0 && Number(installmentAmount) > 0 && !!startDate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex w-[440px] flex-col gap-5 rounded-[16px] border border-ds-border bg-ds-surface p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[17px] font-bold tracking-[-0.3px] text-brand-ink">
              Generar contrato
            </span>
            <span className="text-[13px] font-medium text-ds-muted">
              Términos negociados del préstamo. Se usan para el contrato (PDF).
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-ds-muted hover:text-brand-ink">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-[7px]">
            <label className="text-[13px] font-medium text-brand-ink">
              Sexo (para el contrato)
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as "M" | "F")}
              className="rounded-[8px] border border-ds-border bg-ds-surface px-[14px] py-[12px] text-sm font-medium text-brand-ink outline-none focus:border-brand-blue-sky"
            >
              <option value="F">Femenino</option>
              <option value="M">Masculino</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Cuotas"
              type="number"
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
            />
            <Field
              label="Valor cuota (RD$)"
              type="number"
              value={installmentAmount}
              onChange={(e) => setInstallmentAmount(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-[7px]">
              <label className="text-[13px] font-medium text-brand-ink">Frecuencia</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as Frequency)}
                className="rounded-[8px] border border-ds-border bg-ds-surface px-[14px] py-[12px] text-sm font-medium text-brand-ink outline-none focus:border-brand-blue-sky"
              >
                <option value="DAILY">Diaria</option>
                <option value="WEEKLY">Semanal</option>
                <option value="BIWEEKLY">Quincenal</option>
                <option value="MONTHLY">Mensual</option>
              </select>
            </div>
            <div className="flex flex-col gap-[7px]">
              <label className="text-[13px] font-medium text-brand-ink">Primera cuota</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-[8px] border border-ds-border bg-ds-surface px-[14px] py-[11px] text-sm font-medium text-brand-ink outline-none focus:border-brand-blue-sky"
              />
            </div>
          </div>
        </div>

        {generate.isError && (
          <span className="text-[13px] text-ds-red">
            No se pudo generar el contrato. {generate.error.message}
          </span>
        )}

        <div className="flex justify-end gap-[10px]">
          <Button variant="secondary" onClick={onClose} disabled={generate.isPending}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            icon={FileDown}
            disabled={generate.isPending || !valid}
            onClick={() =>
              generate.mutate({
                id,
                gender,
                installments: Number(installments),
                installmentAmount: Number(installmentAmount),
                frequency,
                startDate: new Date(`${startDate}T12:00:00`).toISOString()
              })
            }
          >
            {generate.isPending ? "Generando…" : "Generar y descargar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
