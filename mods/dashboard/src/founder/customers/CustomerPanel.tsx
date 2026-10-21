/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The customer profile (Pencil EzobQ sec-12 B): opened from "Ver perfil" in
 * search and from the feed. Admins and reviewers edit the customer's data, see
 * and upload documents, see their loans (with "Renovar" as a quiet secondary
 * action on active ones) and past applications.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  MessageCircle,
  PanelRightOpen,
  RefreshCw,
  Save,
  UserRound,
  RotateCcw
} from "lucide-react";
import { isOpenRenewalStatus } from "@mikro/common/schemas";
import { trpc, type RouterOutputs } from "../../lib/trpc";
import { useToast } from "../../components/ui/ToastProvider";
import { friendlyError, formatDop } from "../../lib/applications";
import { loanStatusMeta, PAYMENT_FREQUENCY_LABELS, DAY_OF_WEEK_LABELS } from "../../lib/customers";
import { cn } from "../../lib/cn";
import { SidePanel } from "../components/SidePanel";
import { useApplicationPanel } from "../applications/ApplicationPanelContext";
import { readFileBase64 } from "../applications/helpers";
import { useViewer } from "../applications/useViewer";
import { Btn, INPUT_CLASS, PanelField, PanelSelect, SectionLabel } from "../applications/ui";
import { StatusPill } from "../applications/ui";
import { RenewalStatusPill } from "../renewals/RenewalStatusPill";
import { useStartRenewal } from "../renewals/useStartRenewal";
import { CustomerDocTile } from "./CustomerDocTile";
import { FileDropZone } from "./FileDropZone";
import { ACCEPT_FILES, UPLOAD_TYPES, documentTypeLabel } from "./labels";

export type CustomerTab = "datos" | "documentos" | "prestamos" | "solicitudes";

const TABS: Array<{ id: CustomerTab; label: string }> = [
  { id: "datos", label: "Datos" },
  { id: "documentos", label: "Documentos" },
  { id: "prestamos", label: "Préstamos" },
  { id: "solicitudes", label: "Solicitudes" }
];

const CEDULA = /^\d{3}-\d{7}-\d{1}$/;

interface Form {
  name: string;
  nickname: string;
  phone: string;
  idNumber: string;
  homeAddress: string;
  collectionPoint: string;
  jobPosition: string;
  income: string;
  preferredPaymentDay: string;
  assignedCollectorId: string;
  notes: string;
}

type CustomerRow = NonNullable<RouterOutputs["getCustomer"]>;

function formOf(c: CustomerRow): Form {
  return {
    name: c.name ?? "",
    nickname: c.nickname ?? "",
    phone: c.phone ?? "",
    idNumber: c.idNumber ?? "",
    homeAddress: c.homeAddress ?? "",
    collectionPoint: c.collectionPoint ?? "",
    jobPosition: c.jobPosition ?? "",
    income: c.income == null ? "" : String(Number(c.income)),
    preferredPaymentDay: c.preferredPaymentDay ?? "",
    assignedCollectorId: c.assignedCollectorId ?? "",
    notes: c.notes ?? ""
  };
}

/** Only what changed, with cleared optional fields sent as null. */
function changes(original: Form, form: Form) {
  const out: Record<string, unknown> = {};
  const nullable = (key: keyof Form) => {
    if (form[key] === original[key]) return;
    out[key] = form[key].trim() === "" ? null : form[key].trim();
  };
  for (const key of ["name", "phone", "idNumber", "homeAddress", "assignedCollectorId"] as const) {
    if (form[key].trim() !== original[key].trim()) out[key] = form[key].trim();
  }
  nullable("nickname");
  nullable("collectionPoint");
  nullable("jobPosition");
  if (form.income !== original.income) {
    out.income = form.income.trim() === "" ? null : Number(form.income);
  }
  if (form.preferredPaymentDay !== original.preferredPaymentDay) {
    out.preferredPaymentDay = form.preferredPaymentDay || null;
  }
  if (form.notes !== original.notes) out.notes = form.notes;
  return out;
}

function validate(form: Form): string | null {
  if (!form.name.trim()) return "El nombre es obligatorio.";
  if (!CEDULA.test(form.idNumber.trim())) return "La cédula debe tener el formato 000-0000000-0.";
  if (!form.homeAddress.trim()) return "La dirección es obligatoria.";
  if (form.income.trim() !== "" && !Number.isFinite(Number(form.income))) {
    return "Los ingresos deben ser un número.";
  }
  if (form.collectionPoint.trim() && !/^https?:\/\//i.test(form.collectionPoint.trim())) {
    return "El punto de cobro debe ser un enlace (https://…).";
  }
  return null;
}

function DatosTab({ customer }: { customer: CustomerRow }) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const users = trpc.listUsers.useQuery({ limit: 100 });
  const original = useMemo(() => formOf(customer), [customer]);
  const [form, setForm] = useState<Form>(original);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setForm(original), [original]);

  const collectors = useMemo(
    () => (users.data ?? []).filter((u) => u.roles?.some((r) => r.role === "COLLECTOR")),
    [users.data]
  );
  const update = trpc.updateCustomer.useMutation({
    onSuccess: async () => {
      toast.success("Datos del cliente guardados.");
      setError(null);
      await utils.getCustomer.invalidate({ id: customer.id });
    },
    onError: (e) => setError(friendlyError(e, "No se pudo guardar el cliente."))
  });

  const dirty = Object.keys(changes(original, form)).length > 0;
  const set = (key: keyof Form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const text = (key: keyof Form, placeholder?: string) => (
    <input
      value={form[key]}
      onChange={(e) => set(key)(e.target.value)}
      placeholder={placeholder}
      data-testid={`customer-${key}`}
      className={INPUT_CLASS}
    />
  );

  function save() {
    const problem = validate(form);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    update.mutate({ id: customer.id, ...changes(original, form) } as never);
  }

  return (
    <div className="flex flex-col gap-[12px]" data-testid="customer-datos">
      <SectionLabel>DATOS DEL CLIENTE · EDITABLES</SectionLabel>
      <div className="flex gap-3">
        <PanelField label="Nombre">{text("name")}</PanelField>
        <PanelField label="Apodo">{text("nickname")}</PanelField>
      </div>
      <div className="flex gap-3">
        <PanelField label="Teléfono">{text("phone")}</PanelField>
        <PanelField label="Cédula">{text("idNumber", "000-0000000-0")}</PanelField>
      </div>
      <div className="flex gap-3">
        <PanelField label="Dirección">{text("homeAddress")}</PanelField>
        <PanelField label="Punto de cobro (enlace)">
          {text("collectionPoint", "https://…")}
        </PanelField>
      </div>
      <div className="flex gap-3">
        <PanelField label="Ocupación">{text("jobPosition")}</PanelField>
        <PanelField label="Ingresos mensuales (RD$)">{text("income")}</PanelField>
      </div>
      <div className="flex gap-3">
        <PanelField label="Día de pago preferido">
          <PanelSelect
            value={form.preferredPaymentDay}
            onChange={(e) => set("preferredPaymentDay")(e.target.value)}
          >
            <option value="">Sin preferencia</option>
            {Object.entries(DAY_OF_WEEK_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </PanelSelect>
        </PanelField>
        <PanelField label="Cobrador asignado">
          <PanelSelect
            value={form.assignedCollectorId}
            onChange={(e) => set("assignedCollectorId")(e.target.value)}
          >
            {!collectors.some((c) => c.id === form.assignedCollectorId) && (
              <option value={form.assignedCollectorId}>
                {form.assignedCollectorId ? "Cobrador actual" : "Sin cobrador"}
              </option>
            )}
            {collectors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </PanelSelect>
        </PanelField>
      </div>
      <PanelField label="Notas">
        <textarea
          value={form.notes}
          onChange={(e) => set("notes")(e.target.value)}
          rows={2}
          data-testid="customer-notes"
          className={INPUT_CLASS}
        />
      </PanelField>
      {error && (
        <p data-testid="customer-error" className="text-[12px] font-medium text-ds-red">
          {error}
        </p>
      )}
      <div className="flex items-center gap-[10px]">
        <Btn
          tone="primary"
          icon={Save}
          disabled={!dirty || update.isPending}
          onClick={save}
          data-testid="customer-save"
        >
          Guardar cambios
        </Btn>
        <Btn
          icon={RotateCcw}
          disabled={!dirty}
          onClick={() => {
            setForm(original);
            setError(null);
          }}
        >
          Descartar
        </Btn>
        <span className="text-[11px] font-medium text-ds-muted">
          Cédula y teléfono se validan igual que al crear el cliente.
        </span>
      </div>
    </div>
  );
}

function DocumentosTab({ customerId, isAdmin }: { customerId: string; isAdmin: boolean }) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const docs = trpc.listCustomerDocuments.useQuery({ customerId });
  const [type, setType] = useState<(typeof UPLOAD_TYPES)[number]>("ID_FRONT");
  const [busy, setBusy] = useState(false);

  const upload = trpc.uploadCustomerDocument.useMutation();
  const remove = trpc.deleteCustomerDocument.useMutation({
    onSuccess: async () => {
      toast.success("Documento eliminado.");
      await utils.listCustomerDocuments.invalidate({ customerId });
    },
    onError: (e) => toast.error(friendlyError(e, "No se pudo eliminar el documento."))
  });

  async function onFiles(files: File[]) {
    setBusy(true);
    try {
      for (const file of files) {
        await upload.mutateAsync({
          customerId,
          type,
          originalName: file.name,
          mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" | "application/pdf",
          dataBase64: await readFileBase64(file)
        });
      }
      toast.success(files.length === 1 ? "Documento subido." : "Documentos subidos.");
      await utils.listCustomerDocuments.invalidate({ customerId });
    } catch (e) {
      toast.error(friendlyError(e, "No se pudo subir el documento."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-[12px]" data-testid="customer-documentos">
      <SectionLabel>DOCUMENTOS</SectionLabel>
      <FileDropZone
        title="Arrastra o sube un archivo"
        subtitle="Imagen o PDF · cédula, contrato, foto del negocio u otro"
        accept={ACCEPT_FILES}
        multiple
        busy={busy}
        onFiles={(f) => void onFiles(f)}
        testId="customer-upload"
        extra={
          <div className="w-[150px] shrink-0">
            <PanelSelect
              value={type}
              onChange={(e) => setType(e.target.value as (typeof UPLOAD_TYPES)[number])}
              aria-label="Tipo de documento"
              data-testid="customer-upload-type"
            >
              {UPLOAD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {documentTypeLabel(t)}
                </option>
              ))}
            </PanelSelect>
          </div>
        }
      />
      {docs.isPending && <p className="text-[12px] font-medium text-ds-muted">Cargando…</p>}
      {docs.data && docs.data.length === 0 && (
        <p className="text-[12px] font-medium text-ds-muted">
          Este cliente aún no tiene documentos.
        </p>
      )}
      {docs.data && docs.data.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {docs.data.map((d) => (
            <CustomerDocTile
              key={d.id}
              id={d.id}
              type={d.type}
              originalName={d.originalName}
              mimeType={d.mimeType}
              createdAt={d.createdAt}
              onDelete={isAdmin ? () => remove.mutate({ id: d.id }) : undefined}
            />
          ))}
        </div>
      )}
      <p className="text-[11px] font-medium text-ds-muted">
        Evaluadores suben y ven documentos; solo un admin puede eliminarlos.
      </p>
    </div>
  );
}

function PrestamosTab({ customerId }: { customerId: string }) {
  const toast = useToast();
  const panel = useApplicationPanel();
  const { startOrFind, pending } = useStartRenewal();
  const loans = trpc.listLoansByCustomer.useQuery({ customerId, showAll: true, limit: 100 });
  const renewals = trpc.listLoanRenewalsByCustomer.useQuery({ customerId });

  // The renewal in progress per old-loan number.
  const open = useMemo(() => {
    const m = new Map<number, NonNullable<typeof renewals.data>[number]>();
    for (const r of renewals.data ?? []) {
      if (isOpenRenewalStatus(r.status)) m.set(r.loan.loanId, r);
    }
    return m;
  }, [renewals.data]);

  async function renew(loanNumber: number) {
    try {
      const renewal = await startOrFind(loanNumber);
      panel.openRenewal(renewal.id);
    } catch (e) {
      toast.error(friendlyError(e, "No se pudo iniciar la renovación."));
    }
  }

  return (
    <div className="flex flex-col gap-[10px]" data-testid="customer-prestamos">
      <SectionLabel>PRÉSTAMOS</SectionLabel>
      {loans.isPending && <p className="text-[12px] font-medium text-ds-muted">Cargando…</p>}
      {loans.data?.length === 0 && (
        <p className="text-[12px] font-medium text-ds-muted">Este cliente no tiene préstamos.</p>
      )}
      {(loans.data ?? []).map((l) => {
        const meta = loanStatusMeta(l.status);
        const inProgress = open.get(l.loanId);
        return (
          <div
            key={l.id}
            data-testid="customer-loan"
            data-loan-number={l.loanId}
            className="flex flex-col gap-[10px] rounded-[10px] border border-ds-border bg-ds-surface px-[14px] py-[12px]"
          >
            <div className="flex items-center gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-brand-ink">
                    Préstamo #{l.loanId}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-[9px] py-[2px] text-[11px] font-semibold",
                      l.status === "ACTIVE"
                        ? "bg-ds-green-bg text-ds-green"
                        : meta.tone === "red"
                          ? "bg-ds-red-bg text-ds-red"
                          : "bg-ds-subtle text-ds-muted"
                    )}
                  >
                    {meta.label}
                  </span>
                </div>
                <span className="text-[12px] font-medium text-ds-muted">
                  {formatDop(Number(l.principal))} · {l.termLength} ×{" "}
                  {formatDop(Number(l.paymentAmount))}{" "}
                  {(PAYMENT_FREQUENCY_LABELS[l.paymentFrequency] ?? "").toLowerCase()}
                </span>
              </div>
              {l.status === "ACTIVE" && !inProgress && (
                <Btn
                  icon={RefreshCw}
                  disabled={pending}
                  onClick={() => void renew(l.loanId)}
                  data-testid="customer-renew"
                >
                  Renovar
                </Btn>
              )}
            </div>
            {inProgress && (
              <div className="flex items-center gap-3 rounded-[10px] bg-brand-mist px-[14px] py-[10px]">
                <RefreshCw size={16} className="shrink-0 text-brand-blue-primary" />
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="text-[13px] font-semibold text-brand-ink">
                    Renovación en curso
                  </span>
                  <span>
                    <RenewalStatusPill status={inProgress.status} />
                  </span>
                </div>
                <Btn
                  icon={ArrowRight}
                  onClick={() => panel.openRenewal(inProgress.id)}
                  data-testid="customer-continue-renewal"
                >
                  Continuar renovación
                </Btn>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SolicitudesTab({ customerId }: { customerId: string }) {
  const panel = useApplicationPanel();
  const apps = trpc.listApplicationsByCustomer.useQuery({ customerId });
  return (
    <div className="flex flex-col gap-[10px]" data-testid="customer-solicitudes">
      <SectionLabel>SOLICITUDES ANTERIORES</SectionLabel>
      {apps.isPending && <p className="text-[12px] font-medium text-ds-muted">Cargando…</p>}
      {apps.data?.length === 0 && (
        <p className="text-[12px] font-medium text-ds-muted">
          No hay solicitudes anteriores para este cliente.
        </p>
      )}
      {(apps.data ?? []).map((a) => (
        <div
          key={a.id}
          data-testid="customer-application"
          className="flex items-center gap-3 rounded-[10px] border border-ds-border bg-ds-surface px-[14px] py-[12px]"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <div className="flex items-center gap-2">
              <span className="truncate text-[14px] font-semibold text-brand-ink">
                {[a.firstName, a.lastName].filter(Boolean).join(" ") || "Solicitud"}
                {a.businessName ? ` · ${a.businessName}` : ""}
              </span>
              <StatusPill status={a.status} />
            </div>
            <span className="text-[12px] font-medium text-ds-muted">
              {new Date(a.createdAt).toLocaleDateString("es-DO", {
                day: "numeric",
                month: "short",
                year: "numeric"
              })}
            </span>
          </div>
          <Btn icon={PanelRightOpen} onClick={() => panel.open(a.id, "detail")}>
            Ver solicitud
          </Btn>
        </div>
      ))}
    </div>
  );
}

export function CustomerPanel({
  customerId,
  tab,
  onTab,
  onClose
}: {
  customerId: string;
  tab: CustomerTab;
  onTab: (tab: CustomerTab) => void;
  onClose: () => void;
}) {
  const viewer = useViewer();
  const customer = trpc.getCustomer.useQuery({ id: customerId });
  const docs = trpc.listCustomerDocuments.useQuery({ customerId });
  const loans = trpc.listLoansByCustomer.useQuery({ customerId, showAll: true, limit: 100 });
  const apps = trpc.listApplicationsByCustomer.useQuery({ customerId });
  const c = customer.data;

  const counts: Record<CustomerTab, number | undefined> = {
    datos: undefined,
    documentos: docs.data?.length,
    prestamos: loans.data?.length,
    solicitudes: apps.data?.length
  };
  const activeLoans = (loans.data ?? []).filter((l) => l.status === "ACTIVE").length;
  const waLink = c?.phone ? `https://wa.me/${c.phone.replace(/\D/g, "")}` : undefined;

  return (
    <SidePanel
      open
      onClose={onClose}
      testId="customer-panel"
      icon={UserRound}
      iconClassName="bg-brand-mist text-brand-blue-primary"
      title={c?.name ?? "Cliente"}
      subtitle={
        c ? [c.nickname, c.jobPosition, c.homeAddress].filter(Boolean).join(" · ") : undefined
      }
    >
      {customer.isError && (
        <p className="text-[13px] font-medium text-ds-red">
          {friendlyError(customer.error, "No se pudo cargar el cliente.")}
        </p>
      )}
      {c && (
        <div className="flex flex-col gap-[18px]">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-[5px] rounded-full px-[9px] py-[3px] text-[11px] font-semibold",
                c.isActive ? "bg-ds-green-bg text-ds-green" : "bg-ds-subtle text-ds-muted"
              )}
            >
              <span
                className={cn(
                  "h-[6px] w-[6px] rounded-full",
                  c.isActive ? "bg-ds-green" : "bg-ds-muted"
                )}
              />
              {c.isActive ? "Activo" : "Inactivo"}
            </span>
            <span className="text-[12px] font-medium text-ds-muted">
              {c.phone} · cédula {c.idNumber}
              {loans.data
                ? ` · ${loans.data.length} préstamos, ${activeLoans} activo${activeLoans === 1 ? "" : "s"}`
                : ""}
            </span>
          </div>
          {waLink && (
            <div>
              <a href={waLink} target="_blank" rel="noreferrer">
                <Btn icon={MessageCircle} tabIndex={-1}>
                  WhatsApp
                </Btn>
              </a>
            </div>
          )}

          <div className="flex gap-[22px] border-b border-ds-border" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                data-testid={`customer-tab-${t.id}`}
                onClick={() => onTab(t.id)}
                className={cn(
                  "-mb-px border-b-2 pb-[10px] text-[13px]",
                  tab === t.id
                    ? "border-brand-blue-primary font-semibold text-brand-blue-primary"
                    : "border-transparent font-medium text-ds-muted hover:text-brand-ink"
                )}
              >
                {t.label}
                {counts[t.id] != null ? ` · ${counts[t.id]}` : ""}
              </button>
            ))}
          </div>

          {tab === "datos" && <DatosTab customer={c} />}
          {tab === "documentos" && (
            <DocumentosTab customerId={customerId} isAdmin={viewer?.isAdmin ?? false} />
          )}
          {tab === "prestamos" && <PrestamosTab customerId={customerId} />}
          {tab === "solicitudes" && <SolicitudesTab customerId={customerId} />}
        </div>
      )}
    </SidePanel>
  );
}
