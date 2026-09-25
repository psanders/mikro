/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Contract step of an APPROVED application. The terms are entered once here:
 * the generated contract prints them with the approved amount, the server
 * stores them, and the disbursement must lend exactly them. Then the signed
 * PDF is uploaded (the status stays APPROVED; conversion requires it).
 */
import { useRef, useState } from "react";
import { CheckCircle2, Download, FileUp, Trash2 } from "lucide-react";
import { trpc } from "../../../lib/trpc";
import { useToast } from "../../../components/ui/ToastProvider";
import { formatDate, formatDop, friendlyError } from "../../../lib/applications";
import { base64ToBytes, saveFile, savedMessage } from "../../../lib/saveFile";
import { SidePanel } from "../../components/SidePanel";
import {
  contractTermsOf,
  FREQUENCY_LABELS,
  INSTALLMENT_PLURAL,
  readFileBase64,
  shiftPeriod,
  toDateInput,
  todayDate,
  useApplicationInvalidation,
  type Frequency
} from "../helpers";
import { Btn, INPUT_CLASS, PanelField, SectionLabel } from "../ui";
import type { ViewProps } from "./types";

export function ContractView({ app, viewer, onView, panel }: ViewProps) {
  const toast = useToast();
  const invalidate = useApplicationInvalidation();
  const stored = contractTermsOf(app);
  const approved = Number(app.approvedAmount ?? 0);
  const [installments, setInstallments] = useState(
    String(stored?.installments ?? app.approvedTermWeeks ?? "")
  );
  const [installmentAmount, setInstallmentAmount] = useState(
    stored ? String(stored.installmentAmount) : ""
  );
  const [frequency, setFrequency] = useState<Frequency>(stored?.frequency ?? "WEEKLY");
  const [startDate, setStartDate] = useState(
    stored ? stored.startDate.slice(0, 10) : toDateInput(shiftPeriod(todayDate(), "WEEKLY", 1))
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const writable =
    app.status === "APPROVED" && (app.assignedReviewerId === viewer.id || viewer.isAdmin);

  const generate = trpc.generateApplicationContract.useMutation();
  const upload = trpc.uploadSignedContract.useMutation();
  const remove = trpc.deleteApplicationContract.useMutation();
  const termsValid =
    Number(installments) > 0 && Number(installmentAmount) > 0 && Boolean(startDate);
  const total = Number(installments) * Number(installmentAmount);

  async function onGenerate() {
    try {
      const pdf = await generate.mutateAsync({
        id: app.id,
        installments: Number(installments),
        installmentAmount: Number(installmentAmount),
        frequency,
        startDate
      });
      const result = await saveFile(base64ToBytes(pdf.dataBase64), pdf.filename, pdf.mimeType);
      if (result.status === "saved") toast.success(savedMessage("Contrato", result, pdf.filename));
      await invalidate(app.id);
    } catch (e) {
      toast.error(friendlyError(e, "No se pudo generar el contrato."));
    }
  }

  async function onUpload(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("El contrato firmado debe ser un PDF.");
      return;
    }
    try {
      await upload.mutateAsync({
        id: app.id,
        originalName: file.name,
        mimeType: "application/pdf",
        dataBase64: await readFileBase64(file)
      });
      toast.success("Contrato firmado guardado.");
      await invalidate(app.id);
    } catch (e) {
      toast.error(friendlyError(e, "No se pudo subir el contrato."));
    }
  }

  const footer = (
    <>
      <span className="flex-1" />
      <Btn onClick={() => onView("detail")}>Cerrar</Btn>
      <Btn
        tone="primary"
        disabled={!app.contractFilename}
        title={app.contractFilename ? undefined : "Falta el contrato firmado"}
        onClick={() => onView("disburse")}
      >
        Registrar desembolso
      </Btn>
    </>
  );

  return (
    <SidePanel open {...panel} footer={footer}>
      <div className="flex flex-col gap-6" data-testid="contract-view">
        <section className="flex flex-col gap-3">
          <SectionLabel>1 · Términos del contrato</SectionLabel>
          <div className="rounded-[10px] bg-[#EEF3F9] px-4 py-3 text-[13px] font-medium text-[#14254A]">
            Monto aprobado <b>{formatDop(approved)}</b> · plazo aprobado{" "}
            {app.approvedTermWeeks ?? "—"} semanas
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PanelField label="Cuotas">
              <input
                className={INPUT_CLASS}
                inputMode="numeric"
                value={installments}
                disabled={!writable}
                onChange={(e) => setInstallments(e.target.value.replace(/\D/g, ""))}
                data-testid="contract-installments"
              />
            </PanelField>
            <PanelField label="Monto de cada cuota (RD$)">
              <input
                className={INPUT_CLASS}
                inputMode="decimal"
                value={installmentAmount}
                disabled={!writable}
                onChange={(e) => setInstallmentAmount(e.target.value.replace(/[^\d.]/g, ""))}
                data-testid="contract-installment-amount"
              />
            </PanelField>
            <PanelField label="Frecuencia">
              <select
                className={INPUT_CLASS}
                value={frequency}
                disabled={!writable}
                onChange={(e) => {
                  const f = e.target.value as Frequency;
                  setFrequency(f);
                  setStartDate(toDateInput(shiftPeriod(todayDate(), f, 1)));
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
                value={startDate}
                disabled={!writable}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </PanelField>
          </div>
          {termsValid && (
            <p className="text-[12px] font-medium text-[#697A93]">
              Total a pagar {formatDop(total)} en {installments} cuotas{" "}
              {INSTALLMENT_PLURAL[frequency]}.
            </p>
          )}
          <div className="flex items-center gap-[10px]">
            <Btn
              icon={Download}
              disabled={!writable || !termsValid || generate.isPending}
              onClick={() => void onGenerate()}
              data-testid="contract-generate"
            >
              {stored ? "Regenerar y descargar" : "Generar y descargar"}
            </Btn>
            {stored && (
              <span className="text-[12px] font-medium text-[#16A34A]">
                Términos guardados · primera cuota {formatDate(stored.startDate)}
              </span>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel>2 · Contrato firmado</SectionLabel>
          {app.contractFilename ? (
            <div className="flex items-center gap-2 rounded-[10px] bg-[#E8F7EE] px-3 py-[10px] text-[13px] font-semibold text-[#16A34A]">
              <CheckCircle2 size={15} />
              <span className="flex-1">Contrato firmado subido</span>
              {writable && (
                <>
                  <button
                    type="button"
                    className="text-[12px] text-[#1F4AA8]"
                    onClick={() => fileInput.current?.click()}
                  >
                    Reemplazar
                  </button>
                  <button
                    type="button"
                    aria-label="Quitar contrato"
                    className="text-[#697A93] hover:text-[#DC2626]"
                    onClick={async () => {
                      try {
                        await remove.mutateAsync({ id: app.id });
                        await invalidate(app.id);
                      } catch (e) {
                        toast.error(friendlyError(e, "No se pudo quitar el contrato."));
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ) : (
            <Btn
              tone="primary"
              icon={FileUp}
              disabled={!writable || !stored || upload.isPending}
              title={stored ? undefined : "Genera el contrato primero"}
              onClick={() => fileInput.current?.click()}
              data-testid="contract-upload"
            >
              Subir contrato firmado (PDF)
            </Btn>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf"
            hidden
            data-testid="contract-upload-input"
            onChange={(e) => {
              void onUpload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </section>
      </div>
    </SidePanel>
  );
}
