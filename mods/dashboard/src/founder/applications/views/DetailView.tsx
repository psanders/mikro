/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * "Ver solicitud completa" (Pencil UbCzS): everything about one application,
 * read-only, with the viewer's key action for its current step in the header
 * row. Sections: data, documents, activity (this application's events), and
 * conversation (the persisted WhatsApp transcript, #299).
 */
import { useState } from "react";
import { FileText, Images, Landmark, Pencil, Sparkles, UserCheck, UserPlus } from "lucide-react";
import { trpc } from "../../../lib/trpc";
import { useToast } from "../../../components/ui/ToastProvider";
import { checkAction, forTransition, formatDate, friendlyError } from "../../../lib/applications";
import { SidePanel } from "../../components/SidePanel";
import { APPLICATION_FIELD_SECTIONS, fieldDisplay } from "../fields";
import { useApplicationInvalidation } from "../helpers";
import { Btn, SectionLabel } from "../ui";
import { DocThumb } from "./DocThumb";
import { ConversationThread } from "../ConversationThread";
import type { ViewProps } from "./types";

const ANCHORS = [
  { id: "datos", label: "Datos" },
  { id: "documentos", label: "Documentos" },
  { id: "actividad", label: "Actividad" },
  { id: "conversacion", label: "Conversación" }
] as const;

export function DetailView({ app, evidence, viewer, onView, onClose, panel }: ViewProps) {
  const toast = useToast();
  const invalidate = useApplicationInvalidation();
  const [anchor, setAnchor] = useState<string>("datos");
  const rules = forTransition(app);
  const assign = trpc.assignApplication.useMutation({
    onSuccess: async () => {
      toast.success("Solicitud tomada. Ya está en tu feed.");
      await invalidate(app.id);
    },
    onError: (e) => toast.error(friendlyError(e, "No se pudo tomar la solicitud."))
  });
  const activity = trpc.listFeedEvents.useQuery({ applicationId: app.id, limit: 50 });
  const conversation = trpc.getApplicationConversation.useQuery({ applicationId: app.id });
  const record = app as unknown as Record<string, unknown>;

  const take = checkAction(rules, "assign", viewer);
  const canWorkEvidence = app.status === "IN_REVIEW" && app.assignedReviewerId === viewer.id;
  const approvedStep =
    app.status === "APPROVED" && (app.assignedReviewerId === viewer.id || viewer.isAdmin);

  function jump(id: string) {
    setAnchor(id);
    document.getElementById(`app-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <SidePanel open {...panel}>
      <div className="flex flex-col gap-6" data-testid="application-detail">
        <div className="flex flex-wrap items-center gap-[10px]">
          {app.status === "RECEIVED" && (
            <Btn
              tone="primary"
              icon={UserCheck}
              disabled={!take.enabled || assign.isPending}
              title={take.reason}
              onClick={() => assign.mutate({ id: app.id })}
              data-testid="action-take"
            >
              Tomar
            </Btn>
          )}
          {viewer.isAdmin && (app.status === "RECEIVED" || app.status === "IN_REVIEW") && (
            <Btn icon={UserPlus} onClick={() => onView("assign")} data-testid="action-assign">
              {app.status === "IN_REVIEW" ? "Reasignar…" : "Asignar a…"}
            </Btn>
          )}
          {canWorkEvidence && (
            <>
              <Btn tone="primary" icon={Images} onClick={() => onView("evidence")}>
                Subir evidencia
              </Btn>
              <Btn icon={Pencil} onClick={() => onView("edit")}>
                Editar datos
              </Btn>
            </>
          )}
          {app.status === "PENDING_DECISION" && viewer.isAdmin && (
            <Btn tone="primary" onClick={onClose}>
              Ir a la decisión
            </Btn>
          )}
          {approvedStep && (
            <>
              <Btn icon={FileText} onClick={() => onView("contract")}>
                Contrato
              </Btn>
              <Btn
                tone="primary"
                icon={Landmark}
                disabled={!app.contractFilename}
                title={app.contractFilename ? undefined : "Falta el contrato firmado"}
                onClick={() => onView("disburse")}
              >
                Registrar desembolso
              </Btn>
            </>
          )}
        </div>

        <nav className="flex gap-[22px] border-b border-[#E5EAF1]">
          {ANCHORS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => jump(a.id)}
              className={
                anchor === a.id
                  ? "-mb-px border-b-2 border-[#7C3AED] pb-[10px] text-[13px] font-semibold text-[#7C3AED]"
                  : "pb-[10px] text-[13px] font-medium text-[#697A93] hover:text-[#14254A]"
              }
            >
              {a.label}
              {a.id === "documentos"
                ? ` · ${evidence.documents.length + (app.idFrontFilename ? 1 : 0) + (app.idBackFilename ? 1 : 0)}`
                : ""}
            </button>
          ))}
        </nav>

        {app.aiSummary && (
          <div className="flex gap-2 rounded-[10px] bg-[#FAF7FF] p-3">
            <Sparkles size={14} className="mt-[2px] shrink-0 text-[#7C3AED]" />
            <p className="text-[13px] font-medium leading-[1.45] text-[#14254A]">{app.aiSummary}</p>
          </div>
        )}

        <section id="app-datos" className="flex flex-col gap-5">
          {APPLICATION_FIELD_SECTIONS.map((section) => (
            <div key={section.id} className="flex flex-col gap-3">
              <SectionLabel>{section.title}</SectionLabel>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {section.fields.map((f) => (
                  <div key={f.key} className="flex min-w-0 flex-col gap-[3px]">
                    <span className="text-[11px] font-medium text-[#697A93]">{f.label}</span>
                    <span className="break-words text-[13px] font-medium text-[#14254A]">
                      {fieldDisplay(record, f) || "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section id="app-documentos" className="flex flex-col gap-3">
          <SectionLabel>Documentos</SectionLabel>
          <div className="grid grid-cols-4 gap-[10px]">
            <DocThumb
              label="Cédula frente"
              applicationId={app.id}
              side="FRONT"
              present={Boolean(app.idFrontFilename)}
            />
            <DocThumb
              label="Cédula reverso"
              applicationId={app.id}
              side="BACK"
              present={Boolean(app.idBackFilename)}
            />
            {evidence.documents.map((d) => (
              <DocThumb
                key={d.id}
                label={
                  d.label || (d.kind === "BUSINESS_PHOTO" ? "Foto del negocio" : d.originalName)
                }
                documentId={d.id}
                mimeType={d.mimeType}
                present
              />
            ))}
            <DocThumb
              label={app.contractFilename ? "Contrato firmado" : "Contrato (pendiente)"}
              applicationId={app.id}
              contract
              present={Boolean(app.contractFilename)}
            />
          </div>
        </section>

        <section id="app-actividad" className="flex flex-col gap-3">
          <SectionLabel>Actividad</SectionLabel>
          {activity.isPending && <p className="text-[12px] text-[#697A93]">Cargando…</p>}
          <ol className="flex flex-col">
            {[...(activity.data?.items ?? [])].reverse().map((e, i, all) => (
              <li key={e.id} className="flex gap-3">
                <div className="flex w-6 flex-col items-center">
                  <span className="mt-1 h-[10px] w-[10px] rounded-full bg-[#F1EAFE] ring-2 ring-[#7C3AED]" />
                  {i < all.length - 1 && <span className="w-px flex-1 bg-[#E5EAF1]" />}
                </div>
                <div className="flex flex-1 flex-col gap-[2px] pb-4">
                  <span className="text-[13px] font-semibold text-[#14254A]">{e.summary}</span>
                  <span className="text-[11.5px] font-medium text-[#697A93]">
                    {e.actorName} · {formatDate(e.occurredAt)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="app-conversacion">
          <ConversationThread
            turns={conversation.data?.turns ?? []}
            handoffs={conversation.data?.handoffs ?? []}
            personName={app.firstName?.trim() || "Solicitante"}
            chatwootUrl={conversation.data?.chatwootUrl}
            loading={conversation.isPending}
            error={conversation.isError}
          />
        </section>
      </div>
    </SidePanel>
  );
}
