/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Cliente detail — Pencil v2 frame `hvr34`: a two-column layout (flat data
 * content card + 360px rail). The rail carries a financial summary and an inline
 * "Registrar pago" form (real `createPayment` mutation). Accordions and status
 * chips are gone; loan/customer status reads as plain text. Only fields the
 * procedures actually return are shown (code is the source of truth) — computed
 * figures are limited to reliable client-side aggregates.
 */
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { trpc } from "../lib/trpc";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { StatusText } from "../components/ui/StatusText";
import { formatDop, formatDate, isForbidden } from "../lib/applications";
import {
  loanStatusMeta,
  PAYMENT_FREQUENCY_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_KIND_LABELS,
  DAY_OF_WEEK_LABELS
} from "../lib/customers";

// listPaymentsByCustomer requires a date range; cover the full accepted window
// (the backend floor is 2020-01-01) up to now for "recent payments".
const PAYMENTS_START = new Date("2020-01-01T00:00:00.000Z").toISOString();

export function ClienteDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const q = trpc.getCustomer.useQuery({ id }, { enabled: !!id });
  const loans = trpc.listLoansByCustomer.useQuery(
    { customerId: id, showAll: true },
    { enabled: !!id }
  );
  const payments = trpc.listPaymentsByCustomer.useQuery(
    { customerId: id, startDate: PAYMENTS_START, endDate: new Date().toISOString(), limit: 20 },
    { enabled: !!id }
  );
  const users = trpc.listUsers.useQuery({});
  const me = trpc.whoami.useQuery();

  const [payOpen, setPayOpen] = useState(false);

  const userName = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users.data ?? []) map.set(u.id, u.name);
    return map;
  }, [users.data]);

  const refreshPay = () => {
    void utils.listPaymentsByCustomer.invalidate({ customerId: id });
    void utils.listLoansByCustomer.invalidate({ customerId: id });
  };
  const createPayment = trpc.createPayment.useMutation({
    onSuccess: () => {
      setPayOpen(false);
      refreshPay();
    }
  });

  if (q.isPending) return <CenterMessage>Cargando…</CenterMessage>;
  if (q.isError) {
    return (
      <CenterMessage tone="error">
        {isForbidden(q.error) ? "No tienes acceso a este cliente." : q.error.message}
      </CenterMessage>
    );
  }
  const c = q.data;
  if (!c) return <CenterMessage tone="error">Cliente no encontrado.</CenterMessage>;

  const loanList = loans.data ?? [];
  const paymentList = payments.data ?? [];
  const totalPrestado = loanList.reduce((s, l) => s + Number(l.principal), 0);
  const totalPagado = paymentList.reduce((s, p) => s + Number(p.amount), 0);
  const activos = loanList.filter((l) => l.status === "ACTIVE").length;
  const enMora = loanList.some((l) => l.status === "DEFAULTED");
  const activeLoan = loanList.find((l) => l.status === "ACTIVE");

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={c.name}
        subtitle={`${c.nickname ?? c.name} · ${c.isActive ? "Activo" : "Inactivo"}`}
        back={{ label: "Clientes", onClick: () => navigate("/clientes", { viewTransition: true }) }}
      />

      <div className="flex flex-col gap-[14px] overflow-auto p-7">
        <div className="flex items-start gap-5">
          {/* Content */}
          <div className="flex flex-1 flex-col divide-y divide-ds-border overflow-hidden rounded-[14px] border border-ds-border bg-ds-surface">
            <Section label="Datos del cliente">
              <KV k="Nombre completo" v={c.name} />
              <KV k="Apodo" v={c.nickname ?? ""} />
              <KV k="Cédula" v={c.idNumber || ""} />
              <KV k="Teléfono" v={c.phone || ""} />
              <KV k="Dirección" v={c.homeAddress || ""} />
              <KV k="Ocupación" v={c.jobPosition ?? ""} />
              <KV k="Ingreso mensual" v={c.income != null ? formatDop(c.income) : ""} />
              <KV k="Dueño de negocio" v={c.isBusinessOwner ? "Sí" : "No"} />
              <KV
                k="Día de pago"
                v={
                  c.preferredPaymentDay
                    ? (DAY_OF_WEEK_LABELS[c.preferredPaymentDay] ?? c.preferredPaymentDay)
                    : ""
                }
              />
              <KV k="Cédula en archivo" v={c.idCardOnRecord ? "Sí" : "No"} />
              <KV k="Cliente desde" v={formatDate(c.createdAt)} />
            </Section>

            <Section label="Relaciones y asignación">
              <KV
                k="Cobrador asignado"
                v={
                  c.assignedCollectorId
                    ? (userName.get(c.assignedCollectorId) ?? "Asignado")
                    : "Sin asignar"
                }
              />
              <KV k="Creado por" v={c.createdById ? (userName.get(c.createdById) ?? "") : ""} />
              <KV k="Punto de cobro" v={c.collectionPoint ?? ""} />
            </Section>

            {/* Loans */}
            <div className="flex flex-col gap-[14px] px-6 py-5">
              <span className="text-[12px] font-medium tracking-[0.6px] text-ds-muted">
                PRÉSTAMOS
              </span>
              {loans.isPending && <span className="text-[13px] text-ds-muted">Cargando…</span>}
              {loans.isError && (
                <span className="text-[13px] text-ds-red">
                  No se pudieron cargar los préstamos.
                </span>
              )}
              {loans.data && loanList.length === 0 && (
                <span className="text-[13px] text-ds-muted">Este cliente no tiene préstamos.</span>
              )}
              {loanList.length > 0 && (
                <div className="flex flex-col">
                  <div className="flex items-center gap-[14px] border-b border-ds-border pb-[10px] text-[12px] font-medium tracking-[0.3px] text-ds-muted">
                    <span className="w-[120px]">PRÉSTAMO</span>
                    <span className="flex-1">MONTO</span>
                    <span className="flex-1">CUOTA</span>
                    <span className="w-[110px]">FRECUENCIA</span>
                    <span className="w-[90px]">ESTADO</span>
                  </div>
                  {loanList.map((l) => {
                    const st = loanStatusMeta(l.status);
                    return (
                      <div
                        key={l.id}
                        className="flex items-center gap-[14px] border-b border-ds-border py-3 last:border-b-0"
                      >
                        <div className="flex w-[120px] flex-col gap-px">
                          <span className="text-[13px] font-medium text-brand-ink">
                            #{l.loanId}
                          </span>
                          <span className="text-[11px] font-medium text-ds-muted">
                            {formatDate(l.createdAt)}
                          </span>
                        </div>
                        <span className="flex-1 text-[14px] text-brand-ink">
                          {formatDop(l.principal)}
                        </span>
                        <span className="flex-1 text-[14px] text-brand-ink">
                          {formatDop(l.paymentAmount)}
                        </span>
                        <span className="w-[110px] text-[13px] text-ds-muted">
                          {PAYMENT_FREQUENCY_LABELS[l.paymentFrequency] ?? l.paymentFrequency}
                        </span>
                        <span className="w-[90px]">
                          <StatusText tone={st.tone}>{st.label}</StatusText>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent payments */}
            <div className="flex flex-col gap-[14px] px-6 py-5">
              <span className="text-[12px] font-medium tracking-[0.6px] text-ds-muted">
                PAGOS RECIENTES
              </span>
              {payments.isPending && <span className="text-[13px] text-ds-muted">Cargando…</span>}
              {payments.isError && (
                <span className="text-[13px] text-ds-red">No se pudieron cargar los pagos.</span>
              )}
              {payments.data && paymentList.length === 0 && (
                <span className="text-[13px] text-ds-muted">Este cliente no tiene pagos.</span>
              )}
              {paymentList.length > 0 && (
                <div className="flex flex-col">
                  <div className="flex items-center gap-[14px] border-b border-ds-border pb-[10px] text-[12px] font-medium tracking-[0.3px] text-ds-muted">
                    <span className="w-[130px]">FECHA</span>
                    <span className="w-[90px]">PRÉSTAMO</span>
                    <span className="flex-1">MONTO</span>
                    <span className="w-[110px]">TIPO</span>
                    <span className="flex-1">MÉTODO</span>
                  </div>
                  {paymentList.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-[14px] border-b border-ds-border py-3 last:border-b-0"
                    >
                      <span className="w-[130px] text-[13px] text-ds-muted">
                        {formatDate(p.paidAt)}
                      </span>
                      <span className="w-[90px] text-[13px] font-medium text-brand-ink">
                        #{p.loan.loanId}
                      </span>
                      <span className="flex-1 text-[13px] text-brand-ink">
                        {formatDop(p.amount)}
                      </span>
                      <span className="w-[110px] text-[13px] text-ds-muted">
                        {PAYMENT_KIND_LABELS[p.kind] ?? p.kind}
                      </span>
                      <span className="flex-1 text-[13px] text-ds-muted">
                        {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {c.notes && (
              <Section label="Notas" stack>
                <span className="text-[13px] font-medium leading-[1.4] text-brand-ink">
                  {c.notes}
                </span>
              </Section>
            )}
          </div>

          {/* Rail */}
          <div className="flex w-[360px] shrink-0 flex-col gap-4">
            <RailCard label="Resumen">
              <div className="flex flex-col gap-[2px]">
                <span className="text-[12px] font-medium text-ds-muted">Total prestado</span>
                <span className="text-[28px] font-bold tracking-[-0.5px] text-brand-ink">
                  {formatDop(totalPrestado)}
                </span>
              </div>
              <RailRow k="Total pagado" v={formatDop(totalPagado)} />
              <RailRow k="Préstamos activos" v={String(activos)} />
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-medium text-ds-muted">Estado</span>
                <StatusText tone={enMora ? "red" : "neutral"}>
                  {enMora ? "En mora" : "Al día"}
                </StatusText>
              </div>
            </RailCard>

            {activeLoan && (
              <RailCard label="Registrar pago">
                <RailRow k="Préstamo" v={`#${activeLoan.loanId}`} />
                <RailRow k="Cuota" v={formatDop(activeLoan.paymentAmount)} />
                {payOpen ? (
                  <RegistrarPagoForm
                    defaultAmount={Number(activeLoan.paymentAmount) || 0}
                    busy={createPayment.isPending || !me.data?.id}
                    error={createPayment.isError ? createPayment.error.message : undefined}
                    onCancel={() => setPayOpen(false)}
                    onSubmit={(p) =>
                      createPayment.mutate({
                        loanId: activeLoan.loanId,
                        amount: p.amount,
                        method: p.method,
                        notes: p.notes || undefined,
                        collectedById: me.data!.id
                      })
                    }
                  />
                ) : (
                  <Button variant="primary" icon={Plus} block onClick={() => setPayOpen(true)}>
                    Registrar pago
                  </Button>
                )}
              </RailCard>
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
      <span className="min-h-[1.2em] text-[14px] font-medium text-brand-ink">{v}</span>
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

interface PagoTerms {
  amount: number;
  method: "CASH" | "TRANSFER";
  notes: string;
}

function RegistrarPagoForm({
  defaultAmount,
  busy,
  error,
  onCancel,
  onSubmit
}: {
  defaultAmount: number;
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onSubmit: (p: PagoTerms) => void;
}) {
  const [amount, setAmount] = useState(String(defaultAmount || ""));
  const [method, setMethod] = useState<PagoTerms["method"]>("CASH");
  const [notes, setNotes] = useState("");
  const valid = Number(amount) > 0;

  return (
    <div className="flex flex-col gap-3">
      <Field
        label="Monto (RD$)"
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <div className="flex flex-col gap-[7px]">
        <label className="text-[13px] font-medium text-brand-ink">Método</label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as PagoTerms["method"])}
          className="rounded-[8px] border border-ds-border bg-ds-surface px-[14px] py-[12px] text-sm font-medium text-brand-ink outline-none focus:border-brand-blue-sky"
        >
          <option value="CASH">Efectivo</option>
          <option value="TRANSFER">Transferencia</option>
        </select>
      </div>
      <Field label="Nota (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <span className="text-[13px] text-ds-red">{error}</span>}
      <div className="flex gap-[10px]">
        <Button variant="secondary" block disabled={busy} onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          variant="success"
          block
          disabled={busy || !valid}
          onClick={() => onSubmit({ amount: Number(amount), method, notes })}
        >
          Confirmar
        </Button>
      </div>
    </div>
  );
}
