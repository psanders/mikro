/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, MessageCircle, X } from "lucide-react";
import { trpc } from "../lib/trpc";
import { Button } from "./ui/Button";
import { Select } from "./ui/Select";
import { useToast } from "./ui/ToastProvider";
import { applyFormat, formatError } from "../lib/inputFormat";
import { ALL_EDIT_FIELDS } from "../lib/applicationFields";
import type { FieldDef } from "../lib/applicationFields";

// Build sections from the canonical field registry so options stay in sync.
const fieldByKey = new Map(ALL_EDIT_FIELDS.map((f) => [f.key, f]));
const pick = (keys: string[]): FieldDef[] => keys.map((k) => fieldByKey.get(k)!);

const SECTIONS = [
  { title: "SOLICITANTE", fields: pick(["firstName", "lastName", "phone", "idNumber"]) },
  { title: "NEGOCIO", fields: pick(["businessType", "businessName"]) },
  { title: "CRÉDITO", fields: pick(["requestedAmount", "requestedTermWeeks"]) }
];

const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);

const inputCls =
  "w-full rounded-[8px] border border-ds-border bg-ds-surface px-[14px] py-[12px] text-sm font-medium text-brand-ink outline-none focus:border-brand-blue-sky";

interface Props {
  onClose: () => void;
}

export function NuevaSolicitudModal({ onClose }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    for (const f of ALL_FIELDS) {
      if (f.type === "select" && f.options?.length) defaults[f.key] = f.options[0].value;
    }
    return defaults;
  });
  const [sendPromo, setSendPromo] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const setFormatted = (f: FieldDef, v: string) =>
    set(f.key, f.format ? applyFormat(f.format, v) : v);

  const create = trpc.createApplication.useMutation({
    onSuccess: (app) => {
      onClose();
      if (app.promo) {
        if (app.promo.sent) {
          toast.success("Solicitud creada · Promoción enviada");
        } else {
          toast.error(app.promo.error ?? "No se pudo enviar la promoción");
        }
      } else {
        toast.success("Solicitud creada");
      }
      navigate(`/solicitudes/${app.id}`, { viewTransition: true });
    }
  });

  const hasErrors = ALL_FIELDS.some((f) => f.format && formatError(f.format, form[f.key] ?? ""));

  // Promo can only be sent when a valid phone is present (it's the recipient).
  const phoneRaw = form.phone ?? "";
  const phoneValid = phoneRaw.trim() !== "" && !formatError("phone", phoneRaw);
  // Keep the flag honest if the phone is cleared after checking the box.
  const willSendPromo = sendPromo && phoneValid;

  const renderField = (f: FieldDef) => {
    const err = f.format ? formatError(f.format, form[f.key] ?? "") : null;
    return (
      <div key={f.key} className="flex flex-col gap-[6px]">
        <label className="text-[13px] font-medium text-brand-ink">{f.label}</label>
        {f.type === "select" ? (
          <Select
            className="w-full"
            value={form[f.key] ?? ""}
            onChange={(e) => set(f.key, e.target.value)}
          >
            {f.options?.map((o) => (
              <option key={o.value} value={o.value} className="text-brand-ink">
                {o.label}
              </option>
            ))}
          </Select>
        ) : (
          <input
            type="text"
            inputMode={f.format ? "numeric" : undefined}
            className={`${inputCls} placeholder:text-ds-muted ${err ? "border-ds-red focus:border-ds-red" : ""}`}
            placeholder={
              f.format === "cedula"
                ? "000-0000000-0"
                : f.format === "phone"
                  ? "(000) 000-0000"
                  : "Sin completar"
            }
            value={form[f.key] ?? ""}
            onChange={(e) => setFormatted(f, e.target.value)}
          />
        )}
        {err && <span className="text-[12px] font-medium text-ds-red">{err}</span>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="flex max-h-[88vh] w-[760px] flex-col overflow-hidden rounded-[16px] bg-ds-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ds-border px-6 py-5">
          <span className="text-[18px] font-bold tracking-[-0.3px] text-brand-ink">
            Nueva Solicitud
          </span>
          <button type="button" onClick={onClose} className="text-ds-muted hover:text-brand-ink">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-6 overflow-auto p-6">
          {SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.6px] text-ds-muted">
                {section.title}
              </span>
              <div className="grid grid-cols-2 gap-4">{section.fields.map(renderField)}</div>
            </div>
          ))}
          {/* Promo opt-in — highlighted, unchecked by default. Disabled until a
              valid phone is entered (the promo's recipient). */}
          <button
            type="button"
            onClick={() => phoneValid && setSendPromo((v) => !v)}
            disabled={!phoneValid}
            className={`flex items-center gap-3 rounded-[10px] border px-[14px] py-[13px] text-left ${
              phoneValid
                ? "border-ds-green bg-[#E8F7EE]"
                : "cursor-not-allowed border-ds-border bg-ds-bg opacity-60"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-2 ${
                willSendPromo ? "border-ds-green bg-ds-green" : "border-ds-green bg-ds-surface"
              }`}
            >
              {willSendPromo && <Check size={13} className="text-white" strokeWidth={3} />}
            </span>
            <span className="flex flex-1 flex-col gap-[2px]">
              <span className="text-[13px] font-semibold text-brand-ink">
                Enviar promoción por WhatsApp
              </span>
              <span className="text-[11px] font-medium leading-[1.3] text-ds-muted">
                {phoneValid
                  ? "Al guardar, le enviamos la invitación de solicitud al WhatsApp del prospecto."
                  : "Requiere un teléfono válido en la solicitud."}
              </span>
            </span>
            <MessageCircle size={18} className="shrink-0 text-ds-green" />
          </button>
          {create.isError && (
            <span className="text-[13px] text-ds-red">
              No se pudo guardar: {create.error.message}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-ds-border px-6 py-4">
          <span className="text-[12px] text-ds-muted">
            El propósito y demás detalles se completan desde el detalle de la solicitud.
          </span>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={create.isPending || hasErrors}
              onClick={() => create.mutate({ patch: form, sendPromo: willSendPromo })}
            >
              {create.isPending ? "Guardando…" : "Guardar solicitud"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
