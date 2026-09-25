/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The admin's inline decision on a PENDING_DECISION card (Pencil PYWaG):
 * score, AI summary, evidence, the reviewer's recommendation, and editable
 * approved terms. "Aprobar" lends those terms; "Devolver a …" needs a note;
 * "Rechazar…" needs a reason. No popup, no navigation.
 */
import { useState, type ReactNode } from "react";
import { CheckCircle2, ClipboardCheck, Sparkles, Undo2, X } from "lucide-react";
import type { EvidenceStatus } from "@mikro/common/schemas";
import { trpc } from "../../lib/trpc";
import { useToast } from "../../components/ui/ToastProvider";
import { friendlyError, riskBandLabel } from "../../lib/applications";
import { useApplicationInvalidation } from "./helpers";
import { RejectForm } from "./RejectForm";
import { Btn, INPUT_CLASS, PanelField } from "./ui";
import type { ApplicationRow } from "./views/types";

export function DecisionBlock({
  app,
  evidence,
  assigneeName,
  viewFull
}: {
  app: ApplicationRow;
  evidence?: EvidenceStatus;
  assigneeName?: string;
  viewFull: ReactNode;
}) {
  const toast = useToast();
  const invalidate = useApplicationInvalidation();
  const [amount, setAmount] = useState(String(Number(app.requestedAmount ?? 0) || ""));
  const [weeks, setWeeks] = useState(String(app.requestedTermWeeks ?? ""));
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"decide" | "reject">("decide");
  const who = assigneeName ?? "el evaluador";

  const approve = trpc.approveApplication.useMutation({
    onSuccess: async () => {
      toast.success("Aprobada. Vuelve al evaluador para contrato y desembolso.");
      await invalidate(app.id);
    },
    onError: (e) => toast.error(friendlyError(e, "No se pudo aprobar."))
  });
  const giveBack = trpc.returnApplicationToReviewer.useMutation({
    onSuccess: async () => {
      toast.success(`Devuelta a ${who}.`);
      await invalidate(app.id);
    },
    onError: (e) => toast.error(friendlyError(e, "No se pudo devolver."))
  });
  const termsOk = Number(amount) > 0 && Number.isInteger(Number(weeks)) && Number(weeks) > 0;

  return (
    <div className="flex flex-col gap-[14px] pl-[50px]" data-testid="decision-block">
      <div className="flex gap-5 rounded-[12px] border border-[#E5EAF1] bg-white p-4">
        <div className="flex w-[140px] shrink-0 flex-col gap-[6px]">
          <span className="text-[10px] font-semibold tracking-[0.6px] text-[#697A93]">
            MIKRO SCORE
          </span>
          <span className="text-[34px] font-bold leading-none tracking-[-1px] text-[#14254A]">
            {app.score ?? "—"}
            <span className="ml-1 text-[13px] font-medium text-[#697A93]">/ 100</span>
          </span>
          <span className="text-[12px] font-medium text-[#697A93]">
            {riskBandLabel(app.riskBand)}
          </span>
        </div>
        <div className="w-px bg-[#E5EAF1]" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="flex items-center gap-[6px] text-[10px] font-semibold tracking-[0.6px] text-[#7C3AED]">
            <Sparkles size={13} /> RESUMEN IA
          </span>
          <p className="text-[13px] font-medium leading-[1.45] text-[#14254A]">
            {app.aiSummary ?? "Sin resumen todavía."}
          </p>
          <div className="flex flex-wrap items-center gap-[14px] text-[12px] font-medium text-[#697A93]">
            {[
              ["Ubicación", Boolean(evidence?.location)],
              ["Cédula", Boolean(evidence?.idFront && evidence?.idBack)],
              [
                `Fotos · ${evidence?.businessPhotos.have ?? 0}`,
                (evidence?.businessPhotos.have ?? 0) >= (evidence?.businessPhotos.need ?? 3)
              ]
            ].map(([label, ok]) => (
              <span key={String(label)} className="inline-flex items-center gap-[5px]">
                <CheckCircle2 size={13} className={ok ? "text-[#16A34A]" : "text-[#697A93]"} />
                {label}
              </span>
            ))}
            {viewFull}
          </div>
        </div>
        <div className="w-px bg-[#E5EAF1]" />
        <div className="flex w-[240px] shrink-0 flex-col gap-2">
          <span className="flex items-center gap-[6px] text-[10px] font-semibold tracking-[0.6px] text-[#697A93]">
            <ClipboardCheck size={13} /> RECOMENDACIÓN · {who.toUpperCase()}
          </span>
          <p className="text-[13px] font-semibold leading-[1.4] text-[#14254A]">
            {app.reviewerRecommendation ?? "—"}
          </p>
        </div>
      </div>

      {mode === "reject" ? (
        <RejectForm applicationId={app.id} reasonsFor="admin" onDone={() => setMode("decide")} />
      ) : (
        <>
          <div className="flex items-end gap-3 rounded-[12px] border border-[#E5EAF1] bg-white p-[14px]">
            <div className="w-[150px]">
              <PanelField label="Monto aprobado (RD$)">
                <input
                  className={INPUT_CLASS}
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                  data-testid="decision-amount"
                />
              </PanelField>
            </div>
            <div className="w-[140px]">
              <PanelField label="Plazo (semanas)">
                <input
                  className={INPUT_CLASS}
                  inputMode="numeric"
                  value={weeks}
                  onChange={(e) => setWeeks(e.target.value.replace(/\D/g, ""))}
                  data-testid="decision-weeks"
                />
              </PanelField>
            </div>
            <PanelField label={`Nota para ${who}`}>
              <input
                className={INPUT_CLASS}
                placeholder="Opcional al aprobar · obligatoria al devolver"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                data-testid="decision-note"
              />
            </PanelField>
          </div>
          <div className="flex flex-wrap items-center gap-[10px]">
            <Btn
              tone="success"
              disabled={!termsOk || approve.isPending}
              onClick={() =>
                approve.mutate({
                  id: app.id,
                  approvedAmount: Number(amount),
                  approvedTermWeeks: Number(weeks),
                  note: note.trim() || undefined
                })
              }
              data-testid="decision-approve"
            >
              Aprobar con estos términos
            </Btn>
            <Btn
              icon={Undo2}
              disabled={!note.trim() || giveBack.isPending}
              title={note.trim() ? undefined : "Escribe una nota para devolver"}
              onClick={() => giveBack.mutate({ id: app.id, note: note.trim() })}
              data-testid="decision-return"
            >
              Devolver a {who}…
            </Btn>
            <Btn icon={X} onClick={() => setMode("reject")} data-testid="decision-reject">
              Rechazar…
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}
