/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Solicitud detail — Pencil v2 frame `VNNl1`: a two-column layout (flat data
 * content card + 360px action rail). The rail carries the Mikro Score, a
 * progress stepper, and the review/decision card (Aprobar / Rechazar / sign /
 * convert by status). Accordions and status chips are gone; status reads as the
 * stepper. All review/pipeline mutations are preserved unchanged.
 */
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Check,
  CheckCircle2,
  Circle,
  CircleDot,
  CircleHelp,
  ArrowRight,
  BarChart2,
  FileText,
  History,
  Upload,
  X,
  Pencil
} from "lucide-react";
import type { ApplicationScore } from "@mikro/common";
import { trpc } from "../lib/trpc";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { ProgressBar } from "../components/ui/ProgressBar";
import { EditSolicitudModal } from "../components/EditSolicitudModal";
import { GenerateContractModal } from "../components/GenerateContractModal";
import {
  statusMeta,
  riskBandMeta,
  allowedActions,
  formatDop,
  formatDate,
  isForbidden
} from "../lib/applications";

const CATEGORY_LABELS: Record<string, string> = {
  PAYMENT_CAPACITY: "Capacidad de pago",
  BUSINESS_TYPE_RISK: "Riesgo del negocio",
  TRACK_RECORD_FORMALIZATION: "Trayectoria y formalización",
  ROOTEDNESS_STABILITY: "Arraigo y estabilidad",
  SUPPORT_NETWORK: "Red de soporte",
  LOAN_PURPOSE: "Propósito del préstamo"
};

// Pipeline steps in order (excludes terminal REJECTED/ABANDONED — handled apart).
const STEPS: Array<{ status: string; label: string }> = [
  { status: "RECEIVED", label: "Nueva" },
  { status: "IN_REVIEW", label: "En evaluación" },
  { status: "APPROVED", label: "Aprobada" },
  { status: "SIGNED", label: "Firmada" },
  { status: "CONVERTED", label: "Convertida" }
];

// Risk band → score-card accent. The score card is one of the few places color
// is kept: it carries a real risk signal.
function bandColor(band: string | null): string {
  if (band === "LOW_RISK") return "text-ds-green";
  if (band === "HIGH_RISK" || band === "VERY_HIGH_RISK" || band === "OUT_OF_COVERAGE")
    return "text-ds-red";
  if (band === "MODERATE_RISK" || band === "MEDIUM_HIGH_RISK") return "text-ds-amber";
  return "text-ds-muted";
}

function nextHint(status: string): string | null {
  switch (status) {
    case "RECEIVED":
    case "IN_REVIEW":
      return "Aprobar → Firmar contrato";
    case "APPROVED":
      return "Subir contrato firmado";
    case "SIGNED":
      return "Convertir a cliente";
    default:
      return null;
  }
}

function raw(app: { rawData?: unknown }, key: string): string {
  const v = (app.rawData as Record<string, unknown> | null)?.[key];
  return typeof v === "string" && v.trim() ? v : "—";
}

export function SolicitudDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);

  const q = trpc.getApplication.useQuery({ id });
  const users = trpc.listUsers.useQuery({});
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [note, setNote] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const userName = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users.data ?? []) map.set(u.id, u.name);
    return map;
  }, [users.data]);

  const refresh = () => {
    void utils.getApplication.invalidate({ id });
    void utils.listApplications.invalidate();
  };
  const noteRefresh = () => {
    setNote("");
    refresh();
  };
  const claim = trpc.claimApplication.useMutation({ onSuccess: refresh });
  const approve = trpc.approveApplication.useMutation({ onSuccess: noteRefresh });
  const reject = trpc.rejectApplication.useMutation({
    onSuccess: () => {
      setRejectOpen(false);
      setRejectReason("");
      refresh();
    }
  });
  const reopen = trpc.reopenApplication.useMutation({ onSuccess: noteRefresh });
  const upload = trpc.uploadSignedContract.useMutation({ onSuccess: refresh });
  const convert = trpc.convertApplication.useMutation({ onSuccess: refresh });

  if (q.isPending) return <CenterMessage>Cargando…</CenterMessage>;
  if (q.isError) {
    return (
      <CenterMessage tone="error">
        {isForbidden(q.error) ? "No tienes acceso a esta solicitud." : q.error.message}
      </CenterMessage>
    );
  }
  const app = q.data;
  if (!app) return <CenterMessage tone="error">Solicitud no encontrada.</CenterMessage>;

  const name = [app.firstName, app.lastName].filter(Boolean).join(" ").trim() || "—";
  const st = statusMeta(app.status);
  const band = riskBandMeta(app.riskBand);
  const score = (app.scoreData as ApplicationScore | null) ?? null;
  const actions = allowedActions(app.status);
  const assignee = app.reviewedById
    ? (userName.get(app.reviewedById) ?? "Asignado")
    : "Sin asignar";
  const terminal = app.status === "REJECTED" || app.status === "ABANDONED";
  const currentIdx = STEPS.findIndex((s) => s.status === app.status);
  const busy =
    claim.isPending ||
    approve.isPending ||
    reject.isPending ||
    reopen.isPending ||
    upload.isPending ||
    convert.isPending;

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = String(reader.result).split(",")[1] ?? "";
      upload.mutate({ id, originalName: f.name, mimeType: "application/pdf", dataBase64: b64 });
    };
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  const viewContract = async () => {
    const c = await utils.getApplicationContract.fetch({ id });
    const bytes = Uint8Array.from(atob(c.dataBase64), (ch) => ch.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    window.open(url, "_blank");
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={`Solicitud #${app.id.slice(0, 8).toUpperCase()}`}
        subtitle={`${name} · ${st.label}`}
        back={{
          label: "Solicitudes",
          onClick: () => navigate("/solicitudes", { viewTransition: true })
        }}
        action={
          <div className="flex items-center gap-[10px]">
            {app.status !== "CONVERTED" && (
              <Button
                variant="secondary"
                icon={Pencil}
                disabled={busy}
                onClick={() => setEditOpen(true)}
              >
                Editar
              </Button>
            )}
            {["APPROVED", "SIGNED", "CONVERTED"].includes(app.status) && (
              <Button
                variant="secondary"
                icon={FileText}
                disabled={busy}
                onClick={() => setContractOpen(true)}
              >
                Generar contrato
              </Button>
            )}
            {app.contractFilename && (
              <Button
                variant="secondary"
                icon={FileText}
                disabled={busy}
                onClick={() => void viewContract()}
              >
                Ver PDF
              </Button>
            )}
          </div>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onPickFile}
      />

      {editOpen && (
        <EditSolicitudModal
          id={id}
          rawData={app.rawData}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            refresh();
          }}
        />
      )}

      {contractOpen && (
        <GenerateContractModal
          id={id}
          defaultInstallments={app.requestedTermWeeks}
          onClose={() => setContractOpen(false)}
        />
      )}

      <div className="flex flex-col gap-[14px] overflow-auto p-7">
        <div className="flex items-start gap-5">
          {/* Content: flat data sections */}
          <div className="flex flex-1 flex-col divide-y divide-ds-border overflow-hidden rounded-[14px] border border-ds-border bg-ds-surface">
            <Section label="Solicitante">
              <KV k="Nombre(s)" v={app.firstName ?? "—"} />
              <KV k="Apellido(s)" v={app.lastName ?? "—"} />
              <KV k="Teléfono" v={app.phone ?? "—"} />
              <KV k="Cédula" v={app.idNumber ?? "—"} />
            </Section>

            <Section label="Negocio">
              <KV k="Tipo de negocio" v={app.businessType ?? "—"} />
              <KV k="Nombre del negocio" v={app.businessName ?? "—"} />
              <KV k="Tiempo operando" v={raw(app, "businessAge")} />
              <KV k="Ventas mensuales" v={raw(app, "monthlySales")} />
              <KV k="Local" v={raw(app, "locationType")} />
              <KV k="Formalización" v={raw(app, "formalization")} />
              <KV k="Nº de empleados" v={raw(app, "employeeCount")} />
            </Section>

            <Section label="Crédito">
              <KV k="Monto solicitado" v={formatDop(app.requestedAmount)} />
              <KV k="Propósito" v={app.purpose ?? "—"} />
              <KV
                k="Plazo"
                v={app.requestedTermWeeks ? `${app.requestedTermWeeks} semanas` : "—"}
              />
            </Section>

            <Section label="Referencias">
              <KV k="Nombre de referencia" v={raw(app, "referenceName")} />
              <KV k="Teléfono de referencia" v={raw(app, "referencePhone")} />
            </Section>

            <Section label="Vivienda">
              <KV k="Tipo de vivienda" v={raw(app, "housingType")} />
              <KV k="Tiempo residiendo" v={raw(app, "residenceTime")} />
              <KV k="Dirección" v={app.homeAddress ?? "—"} />
              <KV k="Provincia" v={app.province ?? "—"} />
            </Section>

            <Section label="Contrato">
              <div className="col-span-3 flex items-center gap-[11px] rounded-[8px] bg-ds-subtle px-[14px] py-3">
                <FileText size={18} className="text-ds-muted" />
                <div className="flex flex-1 flex-col">
                  <span className="text-[13px] font-medium text-brand-ink">
                    Contrato de préstamo
                  </span>
                  <span className="text-[12px] font-medium text-ds-muted">
                    {app.contractFilename
                      ? `${app.contractOriginalName ?? app.contractFilename} · firmado ${formatDate(app.signedAt)}`
                      : "Se genera y sube al firmar, tras la aprobación"}
                  </span>
                </div>
                <span className="text-[13px] font-medium text-ds-muted">
                  {app.contractFilename ? "Firmado" : "Pendiente"}
                </span>
              </div>
            </Section>

            {score && score.evaluator_notes.length > 0 && (
              <Section label="Preguntas sugeridas" stack>
                {score.evaluator_notes.map((n, i) => (
                  <div key={i} className="flex items-start gap-[10px]">
                    <CircleHelp size={16} className="mt-px shrink-0 text-ds-muted" />
                    <div className="flex flex-col gap-[2px]">
                      <span className="text-[11px] font-medium uppercase tracking-[0.4px] text-ds-muted">
                        {n.topic}
                      </span>
                      <span className="text-[13px] font-medium text-brand-ink">{n.question}</span>
                      {n.reason && <span className="text-[12px] text-ds-muted">{n.reason}</span>}
                    </div>
                  </div>
                ))}
              </Section>
            )}

            <div className="flex items-center gap-2 px-6 py-[18px] text-[13px] font-medium">
              <History size={15} className="text-brand-blue-primary" />
              <span className="text-brand-blue-primary">Actividad</span>
              <span className="text-ds-muted">
                · {app.reviewedAt ? `última ${formatDate(app.reviewedAt)}` : "sin actividad"}
              </span>
            </div>
          </div>

          {/* Rail */}
          <div className="flex w-[360px] shrink-0 flex-col gap-4">
            {/* Score */}
            <RailCard label="Mikro Score">
              {app.score != null ? (
                <>
                  <div className="flex items-end gap-[6px]">
                    <span className="text-[44px] font-bold leading-none tracking-[-1px] text-brand-ink">
                      {app.score}
                    </span>
                    <span className="pb-[6px] text-[15px] font-medium text-ds-muted">/ 100</span>
                  </div>
                  {band && (
                    <span className={`text-[14px] font-medium ${bandColor(app.riskBand)}`}>
                      {band.label}
                    </span>
                  )}
                  <div className="h-[6px] w-full overflow-hidden rounded-pill bg-ds-subtle">
                    <div
                      className={`h-[6px] rounded-pill ${app.riskBand === "LOW_RISK" ? "bg-ds-green" : "bg-brand-blue-primary"}`}
                      style={{ width: `${Math.max(0, Math.min(100, app.score))}%` }}
                    />
                  </div>
                  {score && (
                    <>
                      <RailRow k="Recomendación" v={score.recommendation} />
                      <button
                        type="button"
                        onClick={() => setShowBreakdown((v) => !v)}
                        className="flex items-center gap-[7px] text-[13px] font-medium text-brand-blue-primary"
                      >
                        <BarChart2 size={15} />
                        {showBreakdown ? "Ocultar desglose" : "Ver desglose e indicadores"}
                      </button>
                      {showBreakdown && (
                        <div className="flex flex-col gap-3 pt-1">
                          {score.categories.map((c) => (
                            <ProgressBar
                              key={c.category}
                              label={`${CATEGORY_LABELS[c.category] ?? c.category} · ${c.weight}%`}
                              value={`${c.score}/100`}
                              percent={c.score}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <div className="h-px w-full bg-ds-border" />
                </>
              ) : (
                <span className="text-[13px] text-ds-muted">Sin score todavía.</span>
              )}
              <span className="text-[12px] font-medium tracking-[0.6px] text-ds-muted">
                DETALLES
              </span>
              <RailRow k="Asignado a" v={assignee} />
              <RailRow k="Recibida" v={formatDate(app.createdAt)} />
            </RailCard>

            {/* Progress */}
            <RailCard label="Progreso">
              {terminal ? (
                <span className="text-[13px] font-medium text-ds-red">{st.label}</span>
              ) : (
                <>
                  {STEPS.map((s, i) => {
                    const done = i < currentIdx;
                    const active = i === currentIdx;
                    const Icon = done ? CheckCircle2 : active ? CircleDot : Circle;
                    const color = done
                      ? "text-ds-green"
                      : active
                        ? "text-brand-blue-primary"
                        : "text-ds-muted";
                    return (
                      <div key={s.status} className="flex items-center gap-[10px]">
                        <Icon size={16} className={color} />
                        <span
                          className={`text-[13px] font-medium ${active || done ? "text-brand-ink" : "text-ds-muted"}`}
                        >
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                  {nextHint(app.status) && (
                    <div className="flex items-center gap-2 rounded-[8px] bg-ds-subtle px-3 py-[10px]">
                      <ArrowRight size={15} className="text-brand-blue-primary" />
                      <span className="text-[12px] font-medium text-brand-ink">
                        Siguiente: {nextHint(app.status)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </RailCard>

            {/* Review / decision */}
            {(actions.canApprove || actions.canReject || actions.canClaim) && (
              <RailCard label="Revisión">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Agregar nota de revisión…"
                  rows={3}
                  className="w-full resize-none rounded-[8px] border border-ds-border bg-ds-bg px-3 py-[10px] text-[13px] font-medium text-brand-ink outline-none placeholder:text-ds-muted focus:border-brand-blue-sky"
                />
                {rejectOpen ? (
                  <div className="flex flex-col gap-[10px]">
                    <Field
                      label="Motivo del rechazo"
                      placeholder="Explica por qué se rechaza…"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      error={reject.isError ? "No se pudo rechazar" : undefined}
                    />
                    <div className="flex gap-[10px]">
                      <Button
                        variant="secondary"
                        block
                        disabled={busy}
                        onClick={() => setRejectOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        variant="secondary"
                        block
                        className="text-ds-red"
                        disabled={busy || !rejectReason.trim()}
                        onClick={() => reject.mutate({ id, reason: rejectReason.trim() })}
                      >
                        Confirmar rechazo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="text-[11px] font-medium text-ds-muted">
                      El motivo es obligatorio al rechazar.
                    </span>
                    {actions.canClaim && (
                      <Button
                        variant="secondary"
                        block
                        disabled={busy}
                        onClick={() => claim.mutate({ id })}
                      >
                        Tomar
                      </Button>
                    )}
                    {actions.canApprove && (
                      <Button
                        variant="success"
                        icon={Check}
                        block
                        disabled={busy}
                        onClick={() => approve.mutate({ id, note: note.trim() || undefined })}
                      >
                        Aprobar
                      </Button>
                    )}
                    {actions.canReject && (
                      <Button
                        variant="secondary"
                        icon={X}
                        block
                        className="text-ds-red"
                        disabled={busy}
                        onClick={() => setRejectOpen(true)}
                      >
                        Rechazar
                      </Button>
                    )}
                  </>
                )}
              </RailCard>
            )}

            {/* Sign contract */}
            {actions.canSign && (
              <RailCard label="Firmar contrato">
                <span className="text-[13px] text-ds-muted">
                  Sube el PDF del contrato firmado para pasar a Firmada.
                </span>
                <Button
                  variant="primary"
                  icon={Upload}
                  block
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  Subir contrato firmado
                </Button>
              </RailCard>
            )}

            {/* Convert */}
            {actions.canConvert && (
              <RailCard label="Convertir a cliente">
                <ConvertForm
                  defaultPrincipal={Number(app.requestedAmount) || 0}
                  defaultTerm={app.requestedTermWeeks ?? 0}
                  busy={busy}
                  error={convert.isError ? convert.error.message : undefined}
                  onSubmit={(terms) => convert.mutate({ id, ...terms })}
                />
              </RailCard>
            )}

            {/* Converted: linked records */}
            {app.status === "CONVERTED" && (
              <RailCard label="Resultado">
                <RailRow k="Cliente" v={app.customerId ?? "—"} />
                <RailRow k="Préstamo" v={app.loanId != null ? `#${app.loanId}` : "—"} />
              </RailCard>
            )}

            {/* Reopen (terminal / approved) */}
            {actions.canReopen && (
              <Button
                variant="secondary"
                block
                disabled={busy}
                onClick={() => reopen.mutate({ id })}
              >
                Reabrir
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  label,
  stack,
  children
}: {
  label: string;
  stack?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 px-6 py-5">
      <span className="text-[12px] font-medium tracking-[0.6px] text-ds-muted">
        {label.toUpperCase()}
      </span>
      <div className={stack ? "flex flex-col gap-4" : "grid grid-cols-3 gap-x-6 gap-y-4"}>
        {children}
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex flex-col gap-[3px]">
      <span className="text-[12px] font-medium text-ds-muted">{k}</span>
      <span className="text-[14px] font-medium text-brand-ink">{v}</span>
    </div>
  );
}

function RailCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[14px] rounded-[14px] border border-ds-border bg-ds-surface p-5">
      <span className="text-[12px] font-medium tracking-[0.6px] text-ds-muted">
        {label.toUpperCase()}
      </span>
      {children}
    </div>
  );
}

function RailRow({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] font-medium text-ds-muted">{k}</span>
      <span className="text-[13px] font-medium text-brand-ink">{v}</span>
    </div>
  );
}

function CenterMessage({ children, tone }: { children: ReactNode; tone?: "error" }) {
  return (
    <div
      className={`flex h-full items-center justify-center text-sm ${
        tone === "error" ? "text-ds-red" : "text-ds-muted"
      }`}
    >
      {children}
    </div>
  );
}

interface ConvertTerms {
  principal: number;
  termLength: number;
  paymentAmount: number;
  paymentFrequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
}

function ConvertForm({
  defaultPrincipal,
  defaultTerm,
  busy,
  error,
  onSubmit
}: {
  defaultPrincipal: number;
  defaultTerm: number;
  busy: boolean;
  error?: string;
  onSubmit: (terms: ConvertTerms) => void;
}) {
  const [principal, setPrincipal] = useState(String(defaultPrincipal || ""));
  const [termLength, setTermLength] = useState(String(defaultTerm || ""));
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentFrequency, setPaymentFrequency] =
    useState<ConvertTerms["paymentFrequency"]>("WEEKLY");

  const valid = Number(principal) > 0 && Number(termLength) > 0 && Number(paymentAmount) > 0;

  return (
    <div className="flex flex-col gap-3">
      <Field
        label="Principal (RD$)"
        type="number"
        value={principal}
        onChange={(e) => setPrincipal(e.target.value)}
      />
      <Field
        label="Plazo (cuotas)"
        type="number"
        value={termLength}
        onChange={(e) => setTermLength(e.target.value)}
      />
      <Field
        label="Cuota (RD$)"
        type="number"
        value={paymentAmount}
        onChange={(e) => setPaymentAmount(e.target.value)}
      />
      <div className="flex flex-col gap-[7px]">
        <label className="text-[13px] font-medium text-brand-ink">Frecuencia</label>
        <select
          value={paymentFrequency}
          onChange={(e) => setPaymentFrequency(e.target.value as ConvertTerms["paymentFrequency"])}
          className="rounded-[8px] border border-ds-border bg-ds-surface px-[14px] py-[12px] text-sm font-medium text-brand-ink outline-none focus:border-brand-blue-sky"
        >
          <option value="DAILY">Diario</option>
          <option value="WEEKLY">Semanal</option>
          <option value="BIWEEKLY">Quincenal</option>
          <option value="MONTHLY">Mensual</option>
        </select>
      </div>
      {error && <span className="text-[13px] text-ds-red">{error}</span>}
      <Button
        variant="success"
        icon={Check}
        block
        disabled={busy || !valid}
        onClick={() =>
          onSubmit({
            principal: Number(principal),
            termLength: Number(termLength),
            paymentAmount: Number(paymentAmount),
            paymentFrequency
          })
        }
      >
        Convertir y crear préstamo
      </Button>
    </div>
  );
}
