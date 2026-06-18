/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Paperclip } from "lucide-react";
import { trpc } from "../lib/trpc";
import { saveFile } from "../lib/saveFile";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusText } from "../components/ui/StatusText";
import { formatDop, formatDate } from "../lib/applications";
import { typeMeta, statusMeta } from "../lib/accounting";

// /contabilidad/:id — detail for a single accounting transaction (v2: flat
// sections, status as text). Data source: accounting.getTransaction.
export function TransaccionDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const q = trpc.accounting.getTransaction.useQuery({ id }, { enabled: !!id });

  if (q.isPending) return <CenterMessage>Cargando…</CenterMessage>;
  if (q.isError) return <CenterMessage tone="error">{q.error.message}</CenterMessage>;
  const tx = q.data;
  if (!tx) return <CenterMessage tone="error">Transacción no encontrada.</CenterMessage>;

  const tipo = typeMeta(tx.type);
  const estado = statusMeta(tx.status);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={`${tipo.label} · ${formatDop(tx.amount)}`}
        subtitle={`${tx.account.name} · ${formatDate(tx.occurredAt)}`}
        back={{
          label: "Contabilidad",
          onClick: () => navigate("/contabilidad", { viewTransition: true })
        }}
        action={<StatusText tone={estado.tone}>{estado.label}</StatusText>}
      />

      <div className="flex flex-col gap-[14px] overflow-auto p-7">
        {/* Flat content card: detail + attachments */}
        <div className="flex flex-col divide-y divide-ds-border overflow-hidden rounded-[14px] border border-ds-border bg-ds-surface">
          <div className="flex flex-col gap-4 px-6 py-5">
            <span className="text-[12px] font-medium tracking-[0.6px] text-ds-muted">
              DETALLE DE TRANSACCIÓN
            </span>
            <div className="grid grid-cols-3 gap-x-6 gap-y-4">
              <KV label="Tipo" value={<StatusText tone={tipo.tone}>{tipo.label}</StatusText>} />
              <KV
                label="Estado"
                value={<StatusText tone={estado.tone}>{estado.label}</StatusText>}
              />
              <KV label="Monto" value={formatDop(tx.amount)} />
              <KV label="Fecha" value={formatDate(tx.occurredAt)} />
              <KV label="Cuenta" value={tx.account.name} />
              {tx.toAccount && <KV label="Cuenta destino" value={tx.toAccount.name} />}
              {tx.category && <KV label="Categoría" value={tx.category.name} />}
              <KV label="Descripción" value={tx.description ?? ""} />
              <KV label="Proveedor" value={tx.vendor ?? ""} />
              <KV label="Referencia" value={tx.reference ?? ""} />
              <KV label="Registrado por" value={tx.createdBy.name} />
              <KV label="Creado el" value={formatDate(tx.createdAt)} />
            </div>
          </div>

          <div className="flex flex-col gap-4 px-6 py-5">
            <span className="text-[12px] font-medium tracking-[0.6px] text-ds-muted">
              ADJUNTOS · {tx.attachments.length}
            </span>
            {tx.attachments.length === 0 ? (
              <span className="text-[13px] text-ds-muted">Esta transacción no tiene adjuntos.</span>
            ) : (
              <div className="flex flex-col gap-2">
                {tx.attachments.map((att) => (
                  <AttachmentRow key={att.id} attachment={att} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Reverse action — only when POSTED */}
        {tx.status === "POSTED" && (
          <ReverseSection
            transactionId={tx.id}
            onReversed={() => {
              void utils.accounting.getTransaction.invalidate({ id });
              void utils.accounting.listTransactions.invalidate();
            }}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attachment row — fetches bytes on click and triggers download/open
// ---------------------------------------------------------------------------

type Attachment = {
  id: string;
  filename: string;
  originalName: string | null;
  mimeType: string;
  size: number;
};

function AttachmentRow({ attachment }: { attachment: Attachment }) {
  const utils = trpc.useUtils();
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setLoading(true);
    try {
      const payload = await utils.accounting.getTransactionAttachment.fetch({
        id: attachment.id
      });
      const bytes = Uint8Array.from(atob(payload.dataBase64), (c) => c.charCodeAt(0));
      await saveFile(bytes, payload.originalName ?? payload.filename, payload.mimeType);
    } finally {
      setLoading(false);
    }
  }

  const displayName = attachment.originalName ?? attachment.filename;
  const sizeKb = Math.ceil(attachment.size / 1024);

  return (
    <div className="flex items-center justify-between rounded-[10px] border border-ds-border bg-ds-bg px-4 py-3">
      <div className="flex items-center gap-3">
        <Paperclip size={14} className="text-ds-muted" />
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium text-brand-ink">{displayName}</span>
          <span className="text-[11px] text-ds-muted">
            {attachment.mimeType} · {sizeKb} KB
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void handleOpen()}
        disabled={loading}
        className="rounded-[8px] border border-ds-border px-3 py-1 text-[12px] font-medium text-brand-blue-primary hover:bg-ds-subtle disabled:opacity-50"
      >
        {loading ? "Descargando…" : "Descargar"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reverse section
// ---------------------------------------------------------------------------

function ReverseSection({
  transactionId,
  onReversed
}: {
  transactionId: string;
  onReversed: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reverseTx = trpc.accounting.reverseTransaction.useMutation({
    onSuccess: onReversed,
    onError(err) {
      setError(err.message);
    }
  });

  if (!showConfirm) {
    return (
      <div className="rounded-[14px] border border-ds-border bg-ds-surface px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-brand-ink">Revertir transacción</span>
            <span className="text-[12px] text-ds-muted">
              Crea una entrada de reversión y marca esta transacción como Revertida.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="rounded-[10px] border border-ds-border px-4 py-2 text-[13px] font-medium text-ds-red hover:bg-ds-subtle"
          >
            Revertir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-ds-border bg-ds-surface px-6 py-4">
      <div className="flex flex-col gap-3">
        <span className="text-[13px] font-semibold text-brand-ink">Confirmar reversión</span>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-[0.3px] text-ds-muted">
            Notas (opcional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder="Motivo de la reversión…"
            className="rounded-[8px] border border-ds-border bg-ds-bg px-3 py-2 text-[13px] text-brand-ink focus:outline-none"
          />
        </div>
        {error && (
          <p className="text-sm text-ds-red" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setShowConfirm(false);
              setError(null);
            }}
            className="rounded-[10px] border border-ds-border px-4 py-2 text-[13px] font-medium text-brand-ink hover:bg-ds-subtle"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={reverseTx.isPending}
            onClick={() =>
              reverseTx.mutate({
                id: transactionId,
                notes: notes || undefined
              })
            }
            className="rounded-[10px] bg-ds-red px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {reverseTx.isPending ? "Revirtiendo…" : "Confirmar reversión"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function KV({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-[3px]">
      <span className="text-[12px] font-medium text-ds-muted">{label}</span>
      <span className="min-h-[1.2em] text-[14px] font-medium text-brand-ink">{value}</span>
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
