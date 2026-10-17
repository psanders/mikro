/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The admin's inline decision on a PENDING_DECISION card (Pencil PYWaG):
 * score, AI summary, evidence, the reviewer's recommendation, and editable
 * approved terms. "Aprobar" lends those terms; "Devolver a …" needs a note;
 * "Rechazar…" needs a reason. No popup, no navigation.
 */
import { useState, type ReactNode } from "react";
import { CheckCircle2, ClipboardCheck, OctagonX, Sparkles, Undo2, X } from "lucide-react";
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
  // Credit policy (add-credit-decision-engine): the Mikro Score from every
  // source consulted. Only a checked hard NO blocks approval; lookups that
  // weren't done never do.
  const { data: credit } = trpc.getCreditDecision.useQuery({ applicationId: app.id });
  const hardNo =
    credit?.outcome === "REJECT" ? credit.reasons.map((r) => r.message).join("; ") : null;
  const tone = { APPROVE: "#16A34A", REVIEW: "#D97706", REJECT: "#DC2626" }[
    credit?.outcome ?? "REVIEW"
  ];
  const outcomeLabel = {
    APPROVE: "Aprobable",
    REVIEW: "Revisar",
    REJECT: "Rechazo · NO definitivo"
  };
  const unchecked = credit?.unchecked.filter((u) => u.outcome === "REJECT") ?? [];

  return (
    <div className="flex flex-col gap-[14px] pl-[50px]" data-testid="decision-block">
      <div className="flex gap-5 rounded-[12px] border border-ds-border bg-ds-surface p-4">
        {credit ? (
          <div className="flex w-[200px] shrink-0 flex-col gap-[6px]" data-testid="credit-score">
            <span className="text-[10px] font-semibold tracking-[0.6px] text-ds-muted">
              MIKRO SCORE · TODAS LAS FUENTES
            </span>
            <span
              className="text-[34px] font-bold leading-none tracking-[-1px]"
              style={{ color: tone }}
            >
              {credit.mikroScore ?? "—"}
              <span className="ml-1 text-[13px] font-medium text-ds-muted">/ 100</span>
            </span>
            <span className="text-[12px] font-semibold" style={{ color: tone }}>
              {outcomeLabel[credit.outcome]} · política {credit.policyVersion}
            </span>
            <div className="flex flex-col gap-[2px] pt-1">
              {credit.components.map((c) => (
                <span key={c.id} className="flex justify-between text-[11px] text-ds-muted">
                  {c.label}
                  <b className={c.used ? "font-semibold text-brand-ink" : "font-normal"}>
                    {c.used ? Math.round(c.mapped ?? 0) : "no consultado"}
                  </b>
                </span>
              ))}
            </div>
            {unchecked.length > 0 && (
              <span
                className="text-[11px] text-ds-muted"
                title={unchecked.map((u) => u.message).join("\n")}
              >
                {unchecked.length} regla{unchecked.length === 1 ? "" : "s"} no verificada
                {unchecked.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        ) : (
          <div className="flex w-[140px] shrink-0 flex-col gap-[6px]">
            <span className="text-[10px] font-semibold tracking-[0.6px] text-ds-muted">
              MIKRO SCORE
            </span>
            <span className="text-[34px] font-bold leading-none tracking-[-1px] text-brand-ink">
              {app.score ?? "—"}
              <span className="ml-1 text-[13px] font-medium text-ds-muted">/ 100</span>
            </span>
            <span className="text-[12px] font-medium text-ds-muted">
              {riskBandLabel(app.riskBand)}
            </span>
          </div>
        )}
        <div className="w-px bg-ds-border" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="flex items-center gap-[6px] text-[10px] font-semibold tracking-[0.6px] text-ds-violet">
            <Sparkles size={13} /> RESUMEN IA
          </span>
          <p className="text-[13px] font-medium leading-[1.45] text-brand-ink">
            {app.aiSummary ?? "Sin resumen todavía."}
          </p>
          <div className="flex flex-wrap items-center gap-[14px] text-[12px] font-medium text-ds-muted">
            {[
              ["Ubicación", Boolean(evidence?.location)],
              ["Cédula", Boolean(evidence?.idFront && evidence?.idBack)],
              [
                `Fotos · ${evidence?.businessPhotos.have ?? 0}`,
                (evidence?.businessPhotos.have ?? 0) >= (evidence?.businessPhotos.need ?? 3)
              ]
            ].map(([label, ok]) => (
              <span key={String(label)} className="inline-flex items-center gap-[5px]">
                <CheckCircle2 size={13} className={ok ? "text-ds-green" : "text-ds-muted"} />
                {label}
              </span>
            ))}
            {viewFull}
          </div>
        </div>
        <div className="w-px bg-ds-border" />
        <div className="flex w-[240px] shrink-0 flex-col gap-2">
          <span className="flex items-center gap-[6px] text-[10px] font-semibold tracking-[0.6px] text-ds-muted">
            <ClipboardCheck size={13} /> RECOMENDACIÓN · {who.toUpperCase()}
          </span>
          <p className="text-[13px] font-semibold leading-[1.4] text-brand-ink">
            {app.reviewerRecommendation ?? "—"}
          </p>
        </div>
      </div>

      {mode === "reject" ? (
        <RejectForm applicationId={app.id} reasonsFor="admin" onDone={() => setMode("decide")} />
      ) : (
        <>
          <div className="flex items-end gap-3 rounded-[12px] border border-ds-border bg-ds-surface p-[14px]">
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
              disabled={!termsOk || approve.isPending || Boolean(hardNo)}
              title={hardNo ? `NO definitivo: ${hardNo}` : undefined}
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
            {hardNo && (
              <span
                className="inline-flex items-center gap-[6px] rounded-[8px] bg-ds-red-bg px-[10px] py-[6px] text-[12px] font-medium text-ds-red"
                data-testid="decision-hard-no"
              >
                <OctagonX size={13} /> NO definitivo: {hardNo}
              </span>
            )}
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
