/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * One application in the Ops feed (Pencil EzobQ §08: QeyK3, ZjqE9, PYWaG).
 * One card per application, rendered from its CURRENT state (the feed joins it
 * onto the latest event), with a single status label and one primary action —
 * the viewer's next step. Highlighted (violet tint) only when the viewer has
 * something to do. Details and multi-step work open the side panel.
 */
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  ClipboardList,
  FileText,
  Inbox,
  Landmark,
  Lock,
  PanelRightOpen,
  Pencil,
  Scale,
  Send,
  Signature,
  Sparkles,
  UserCheck,
  UserPlus,
  UserX,
  X
} from "lucide-react";
import { trpc } from "../../lib/trpc";
import { useToast } from "../../components/ui/ToastProvider";
import {
  checkAction,
  forTransition,
  formatDop,
  friendlyError,
  riskBandLabel
} from "../../lib/applications";
import { cn } from "../../lib/cn";
import { formatClockTime } from "../components/format";
import type { FeedEvent } from "../components/types";
import { useApplicationPanel } from "./ApplicationPanelContext";
import { useApplicationInvalidation } from "./helpers";
import { RejectForm } from "./RejectForm";
import { DecisionBlock } from "./DecisionBlock";
import { Btn, ScoreChip, StatusPill } from "./ui";
import type { Viewer } from "./useViewer";

export interface FeedApplicationState {
  status: string;
  assignedReviewerId: string | null;
  decidedById: string | null;
  score: number | null;
  businessName: string | null;
  aiSummary: string | null;
}

export interface ApplicationFeedCardProps {
  event: FeedEvent & { application: FeedApplicationState };
  viewer: Viewer;
  /** Names of users by id (assignee / decider display). */
  userNames: Map<string, string>;
  defaultExpanded?: boolean;
}

const STATUS_ICON: Record<string, typeof Inbox> = {
  RECEIVED: Inbox,
  IN_REVIEW: ClipboardList,
  PENDING_DECISION: Scale,
  APPROVED: Signature
};

/** Whether the viewer has an action on this application right now. */
export function viewerHasAction(state: FeedApplicationState, viewer: Viewer): boolean {
  switch (state.status) {
    case "RECEIVED":
      return viewer.isReviewer;
    case "IN_REVIEW":
      return state.assignedReviewerId === viewer.id;
    case "PENDING_DECISION":
      return viewer.isAdmin;
    case "APPROVED":
      return state.assignedReviewerId === viewer.id || viewer.isAdmin;
    default:
      return false;
  }
}

export function ApplicationFeedCard({
  event,
  viewer,
  userNames,
  defaultExpanded = false
}: ApplicationFeedCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const state = event.application;
  const id = event.applicationId!;
  const actionable = viewerHasAction(state, viewer);
  const Icon = STATUS_ICON[state.status] ?? ClipboardList;
  const name = event.customerName ?? state.businessName ?? "Solicitud";
  const assignee = state.assignedReviewerId ? userNames.get(state.assignedReviewerId) : undefined;
  const mine = state.assignedReviewerId === viewer.id;

  const meta = useMemo(() => {
    switch (state.status) {
      case "RECEIVED":
        return "En la cola · sin asignar";
      case "IN_REVIEW":
        return mine
          ? "Tomada por ti · reúne la evidencia"
          : `En evaluación con ${assignee ?? "otro evaluador"}`;
      case "PENDING_DECISION":
        return `Evaluada por ${assignee ?? "—"} · lista para decidir`;
      case "APPROVED":
        return "Aprobada · falta contrato firmado y desembolso";
      default:
        return event.summary;
    }
  }, [state.status, mine, assignee, event.summary]);

  return (
    <div
      className={cn("w-full border-b border-[#E5EAF1]", actionable && "bg-[#FAF7FF]")}
      data-testid="application-card"
      data-application-id={id}
      data-status={state.status}
    >
      <div className={cn("flex flex-col gap-3 px-6", expanded ? "pb-4 pt-3" : "py-3")}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full items-center gap-[14px] text-left"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#F1EAFE] text-[#7C3AED]">
            <Icon size={17} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="truncate text-[14px] leading-tight text-[#14254A]">
              <span className="font-semibold">{name}</span>
              {state.businessName && event.customerName && (
                <span className="font-medium"> · {state.businessName}</span>
              )}
            </span>
            <span className="truncate text-[12px] font-medium leading-tight text-[#697A93]">
              {meta}
            </span>
          </span>
          <ScoreChip score={state.score} />
          <StatusPill status={state.status} />
          <span className="text-[12px] font-medium text-[#697A93]">
            {formatClockTime(event.occurredAt)}
          </span>
          {expanded ? (
            <ChevronUp size={15} className="text-[#697A93]" />
          ) : (
            <ChevronDown size={15} className="text-[#697A93]" />
          )}
        </button>
        {expanded && (
          <CardBody applicationId={id} state={state} viewer={viewer} userNames={userNames} />
        )}
      </div>
    </div>
  );
}

function CardBody({
  applicationId,
  state,
  viewer,
  userNames
}: {
  applicationId: string;
  state: FeedApplicationState;
  viewer: Viewer;
  userNames: Map<string, string>;
}) {
  const panel = useApplicationPanel();
  const toast = useToast();
  const invalidate = useApplicationInvalidation();
  const appQ = trpc.getApplication.useQuery({ id: applicationId });
  const evidenceQ = trpc.getApplicationEvidence.useQuery({ id: applicationId });
  const [rejecting, setRejecting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const app = appQ.data;
  const evidence = evidenceQ.data?.status;

  const assign = trpc.assignApplication.useMutation({
    onSuccess: async () => {
      toast.success("Solicitud tomada.");
      await invalidate(applicationId);
    },
    onError: (e) => toast.error(friendlyError(e, "No se pudo tomar la solicitud."))
  });
  const send = trpc.sendApplicationToDecision.useMutation({
    onSuccess: async () => {
      toast.success("Enviada a decisión.");
      await invalidate(applicationId);
    },
    onError: (e) => toast.error(friendlyError(e, "No se pudo enviar a decisión."))
  });
  const withdraw = trpc.withdrawApplication.useMutation({
    onSuccess: async () => {
      toast.success("Marcada como desistida · pasó a Cerradas.");
      await invalidate(applicationId);
    },
    onError: (e) => toast.error(friendlyError(e, "No se pudo marcar como desistida."))
  });

  if (!app) return <p className="pl-[50px] text-[12px] text-[#697A93]">Cargando…</p>;
  const rules = forTransition(app);
  const open = (view?: Parameters<typeof panel.open>[1]) => panel.open(applicationId, view);
  const summary = app.aiSummary ?? state.aiSummary;
  const assigneeName = app.assignedReviewerId ? userNames.get(app.assignedReviewerId) : undefined;

  const viewFull = (
    <button
      type="button"
      onClick={() => open("detail")}
      className="inline-flex items-center gap-[5px] text-[12px] font-semibold text-[#1F4AA8]"
      data-testid="action-view-full"
    >
      <PanelRightOpen size={13} />
      Ver solicitud completa
    </button>
  );

  const summaryLine = summary && (
    <div className="flex gap-2">
      <Sparkles size={13} className="mt-[2px] shrink-0 text-[#7C3AED]" />
      <p className="text-[13px] font-medium leading-[1.45] text-[#14254A]">{summary}</p>
    </div>
  );

  // ---- RECEIVED: only "Tomar" (plus admin assignment) ----
  if (app.status === "RECEIVED") {
    const take = checkAction(rules, "assign", viewer);
    return (
      <div className="flex flex-col gap-3 pl-[50px]">
        {summaryLine}
        <div className="flex flex-wrap items-center gap-[10px]">
          <Btn
            tone="primary"
            icon={UserCheck}
            disabled={!take.enabled || assign.isPending}
            title={take.reason}
            onClick={() => assign.mutate({ id: applicationId })}
            data-testid="action-take"
          >
            Tomar
          </Btn>
          {viewer.isAdmin && (
            <Btn icon={UserPlus} onClick={() => open("assign")} data-testid="action-assign">
              Asignar a…
            </Btn>
          )}
          {viewFull}
        </div>
      </div>
    );
  }

  // ---- IN_REVIEW: evidence is the point ----
  if (app.status === "IN_REVIEW") {
    if (app.assignedReviewerId !== viewer.id) {
      return (
        <div className="flex flex-col gap-3 pl-[50px]">
          {summaryLine}
          <div className="flex flex-wrap items-center gap-[10px]">
            <span className="text-[12.5px] font-medium text-[#697A93]">
              En evaluación con {assigneeName ?? "otro evaluador"}.
            </span>
            {viewer.isAdmin && (
              <Btn icon={UserPlus} onClick={() => open("assign")}>
                Reasignar…
              </Btn>
            )}
            {viewFull}
          </div>
        </div>
      );
    }
    const sendCheck = checkAction(rules, "sendToDecision", viewer, evidence);
    const evidenceDone = Boolean(evidence?.complete);
    return (
      <div className="flex flex-col gap-[14px] pl-[50px]">
        {summaryLine}
        <div className="flex flex-col gap-1 rounded-[12px] border border-[#E5EAF1] bg-white p-3">
          <span className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.6px] text-[#697A93]">
            Para enviar a decisión ·{" "}
            {Number(evidenceDone) + Number(Boolean(app.reviewerRecommendation)) + 1} de 3
          </span>
          <CheckRow done label="Datos del formulario" detail="revisa y corrige si hace falta">
            <Btn icon={Pencil} className="px-3 py-[7px]" onClick={() => open("edit")}>
              Editar
            </Btn>
          </CheckRow>
          <div
            className={cn(
              "flex flex-col gap-3 rounded-[8px] px-3 pb-[14px] pt-[10px]",
              evidenceDone ? "" : "bg-[#FDF1E3]"
            )}
            data-testid="evidence-block"
          >
            <div className="flex items-center gap-[10px]">
              {evidenceDone ? (
                <CheckCircle2 size={16} className="text-[#16A34A]" />
              ) : (
                <CircleDashed size={16} className="text-[#D97706]" />
              )}
              <span className="text-[13px] font-semibold text-[#14254A]">Evidencia</span>
              <span className="text-[12px] font-medium text-[#697A93]">
                cédula {Number(evidence?.idFront) + Number(evidence?.idBack)} de 2 · fotos del
                negocio {evidence?.businessPhotos.have ?? 0} (mín.{" "}
                {evidence?.businessPhotos.need ?? 3})
              </span>
              <span className="flex-1" />
              <Btn
                tone={evidenceDone ? "secondary" : "primary"}
                className="px-3 py-[7px]"
                onClick={() => open("evidence")}
                data-testid="action-evidence"
              >
                {evidenceDone ? "Ver evidencia" : "Subir evidencia"}
              </Btn>
            </div>
          </div>
          <RecommendationRow applicationId={applicationId} value={app.reviewerRecommendation} />
        </div>
        {rejecting ? (
          <RejectForm
            applicationId={applicationId}
            reasonsFor="reviewer"
            onDone={() => setRejecting(false)}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-[10px]">
            <Btn
              tone={sendCheck.enabled ? "primary" : "secondary"}
              icon={Send}
              disabled={!sendCheck.enabled || send.isPending}
              onClick={() => send.mutate({ id: applicationId })}
              data-testid="action-send"
            >
              Enviar a decisión
            </Btn>
            {!sendCheck.enabled && (
              <span className="text-[12px] font-medium text-[#697A93]">{sendCheck.reason}</span>
            )}
            <span className="w-6" />
            <Btn icon={X} onClick={() => setRejecting(true)} data-testid="action-reject">
              Rechazar…
            </Btn>
            {viewFull}
          </div>
        )}
      </div>
    );
  }

  // ---- PENDING_DECISION: the admin decides inline ----
  if (app.status === "PENDING_DECISION") {
    if (!viewer.isAdmin) {
      return (
        <div className="flex flex-col gap-3 pl-[50px]">
          {summaryLine}
          <div className="flex items-center gap-[10px] text-[12.5px] font-medium text-[#697A93]">
            <Lock size={13} />
            Esperando la decisión del admin · la evidencia está fija.
            {viewFull}
          </div>
        </div>
      );
    }
    return (
      <DecisionBlock
        app={app}
        evidence={evidence}
        assigneeName={assigneeName}
        viewFull={viewFull}
      />
    );
  }

  // ---- APPROVED: paperwork, then disbursement ----
  if (app.status === "APPROVED") {
    const canWork = app.assignedReviewerId === viewer.id || viewer.isAdmin;
    const hasTerms = Boolean(app.contractTerms);
    return (
      <div className="flex flex-col gap-[14px] pl-[50px]">
        <div className="flex gap-2 rounded-[8px] bg-[#E8F7EE] px-3 py-[10px] text-[12.5px] font-medium text-[#16A34A]">
          <Scale size={15} className="mt-[1px] shrink-0" />
          Aprobada por {formatDop(app.approvedAmount)} a {app.approvedTermWeeks} semanas
          {app.decisionNote ? ` · “${app.decisionNote}”` : ""}
        </div>
        <div className="flex flex-col gap-1 rounded-[12px] border border-[#E5EAF1] bg-white p-3">
          <span className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.6px] text-[#697A93]">
            Para convertir en cliente · {Number(hasTerms) + Number(Boolean(app.contractFilename))}{" "}
            de 3
          </span>
          <CheckRow done={hasTerms} label="Contrato generado" detail="con los términos aprobados">
            <Btn
              icon={FileText}
              className="px-3 py-[7px]"
              disabled={!canWork}
              onClick={() => open("contract")}
            >
              {hasTerms ? "Ver" : "Generar"}
            </Btn>
          </CheckRow>
          <CheckRow
            done={Boolean(app.contractFilename)}
            todo={hasTerms && !app.contractFilename}
            label="Contrato firmado"
            detail={app.contractFilename ? "subido" : "sube el PDF firmado"}
          >
            {!app.contractFilename && (
              <Btn
                tone={hasTerms ? "primary" : "secondary"}
                className="px-3 py-[7px]"
                disabled={!canWork || !hasTerms}
                onClick={() => open("contract")}
                data-testid="action-contract"
              >
                Subir contrato firmado
              </Btn>
            )}
          </CheckRow>
          <CheckRow
            done={false}
            todo={Boolean(app.contractFilename)}
            locked={!app.contractFilename}
            label="Desembolso"
            detail={
              app.contractFilename ? "listo para registrar" : "se habilita con el contrato firmado"
            }
          >
            <Btn
              tone={app.contractFilename ? "primary" : "secondary"}
              icon={Landmark}
              className="px-3 py-[7px]"
              disabled={!canWork || !app.contractFilename}
              onClick={() => open("disburse")}
              data-testid="action-disburse"
            >
              Registrar desembolso
            </Btn>
          </CheckRow>
        </div>
        <div className="flex items-center gap-4">
          {withdrawing ? (
            <span className="flex items-center gap-2 text-[12.5px] font-medium text-[#14254A]">
              ¿El cliente desistió del préstamo?
              <Btn className="px-3 py-[6px]" onClick={() => withdraw.mutate({ id: applicationId })}>
                Sí, desistió
              </Btn>
              <button
                type="button"
                className="text-[12px] text-[#697A93]"
                onClick={() => setWithdrawing(false)}
              >
                No
              </button>
            </span>
          ) : (
            canWork && (
              <button
                type="button"
                onClick={() => setWithdrawing(true)}
                className="inline-flex items-center gap-[6px] text-[12.5px] font-semibold text-[#697A93] underline"
                data-testid="action-withdraw"
              >
                <UserX size={13} />
                El cliente desistió…
              </button>
            )
          )}
          {viewFull}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pl-[50px]">
      {summaryLine}
      <span className="text-[12px] text-[#697A93]">{riskBandLabel(app.riskBand)}</span>
      {viewFull}
    </div>
  );
}

function CheckRow({
  done,
  todo,
  locked,
  label,
  detail,
  children
}: {
  done: boolean;
  todo?: boolean;
  locked?: boolean;
  label: string;
  detail: string;
  children?: React.ReactNode;
}) {
  const Icon = done ? CheckCircle2 : locked ? Lock : CircleDashed;
  return (
    <div
      className={cn(
        "flex items-center gap-[10px] rounded-[8px] px-3 py-[9px]",
        todo && !done && "bg-[#FDF1E3]",
        locked && "bg-[#EEF3F9]"
      )}
    >
      <Icon
        size={16}
        className={done ? "text-[#16A34A]" : locked ? "text-[#697A93]" : "text-[#D97706]"}
      />
      <span
        className={cn("text-[13px] font-semibold", locked ? "text-[#697A93]" : "text-[#14254A]")}
      >
        {label}
      </span>
      <span className="truncate text-[12px] font-medium text-[#697A93]">{detail}</span>
      <span className="flex-1" />
      {children}
    </div>
  );
}

function RecommendationRow({
  applicationId,
  value
}: {
  applicationId: string;
  value: string | null;
}) {
  const toast = useToast();
  const invalidate = useApplicationInvalidation();
  const [editing, setEditing] = useState(!value);
  const [text, setText] = useState(value ?? "");
  const save = trpc.setApplicationRecommendation.useMutation({
    onSuccess: async () => {
      setEditing(false);
      await invalidate(applicationId);
    },
    onError: (e) => toast.error(friendlyError(e, "No se pudo guardar la recomendación."))
  });
  return (
    <div
      className={cn("flex flex-col gap-2 rounded-[8px] px-3 py-[9px]", !value && "bg-[#FDF1E3]")}
    >
      <div className="flex items-center gap-[10px]">
        {value ? (
          <CheckCircle2 size={16} className="text-[#16A34A]" />
        ) : (
          <CircleDashed size={16} className="text-[#D97706]" />
        )}
        <span className="text-[13px] font-semibold text-[#14254A]">Recomendación</span>
        {!editing && (
          <span className="truncate text-[12px] font-medium text-[#697A93]">“{value}”</span>
        )}
        <span className="flex-1" />
        {!editing && (
          <Btn icon={Pencil} className="px-3 py-[7px]" onClick={() => setEditing(true)}>
            Editar
          </Btn>
        )}
      </div>
      {editing && (
        <div className="flex items-start gap-2 pl-[26px]">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Ej.: Aprobar RD$10,000 a 10 semanas; negocio estable, clientela fija."
            className="flex-1 resize-none rounded-[8px] border border-[#E5EAF1] bg-white px-3 py-2 text-[13px] font-medium text-[#14254A] outline-none focus:border-[#7C3AED]"
            data-testid="recommendation-input"
          />
          <Btn
            tone="primary"
            className="px-3 py-[7px]"
            disabled={!text.trim() || save.isPending}
            onClick={() => save.mutate({ id: applicationId, reviewerRecommendation: text.trim() })}
            data-testid="recommendation-save"
          >
            Guardar
          </Btn>
        </div>
      )}
    </div>
  );
}
