/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState } from "react";
import { X } from "lucide-react";
import { trpc } from "../lib/trpc";
import { Button } from "./ui/Button";
import { EDIT_SECTIONS, ALL_EDIT_KEYS, type FieldDef } from "../lib/applicationFields";

interface EditSolicitudModalProps {
  id: string;
  rawData: unknown;
  onClose: () => void;
  onSaved: () => void;
}

const inputCls =
  "w-full rounded-[8px] border border-ds-border bg-ds-surface px-[14px] py-[10px] text-sm font-medium text-brand-ink outline-none focus:border-brand-blue-sky";

// Single edit modal grouped by the form's sections. Prefilled from rawData;
// saving sends the full field set as a patch to updateApplication (re-scores).
export function EditSolicitudModal({ id, rawData, onClose, onSaved }: EditSolicitudModalProps) {
  const initial = () => {
    const r = (rawData as Record<string, unknown> | null) ?? {};
    const out: Record<string, string> = {};
    for (const k of ALL_EDIT_KEYS) out[k] = typeof r[k] === "string" ? (r[k] as string) : "";
    return out;
  };
  const [form, setForm] = useState<Record<string, string>>(initial);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const update = trpc.updateApplication.useMutation({
    onSuccess: () => onSaved()
  });

  const renderField = (f: FieldDef) => (
    <div key={f.key} className="flex flex-col gap-[6px]">
      <label className="text-[13px] font-medium text-brand-ink">{f.label}</label>
      {f.type === "select" ? (
        <select
          className={`${inputCls} ${(form[f.key] ?? "") === "" ? "text-ds-muted" : ""}`}
          value={form[f.key] ?? ""}
          onChange={(e) => set(f.key, e.target.value)}
        >
          <option value="">Seleccionar…</option>
          {f.options?.map((o) => (
            <option key={o.value} value={o.value} className="text-brand-ink">
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={f.type === "date" ? "date" : "text"}
          className={`${inputCls} placeholder:text-ds-muted`}
          placeholder={f.type === "date" ? undefined : "Sin completar"}
          value={form[f.key] ?? ""}
          onChange={(e) => set(f.key, e.target.value)}
        />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="flex max-h-[88vh] w-[760px] flex-col overflow-hidden rounded-[16px] bg-ds-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-ds-border px-6 py-4">
          <span className="text-[17px] font-bold text-brand-ink">Editar solicitud</span>
          <button type="button" onClick={onClose} className="text-ds-muted hover:text-brand-ink">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-6 overflow-auto p-6">
          {EDIT_SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.6px] text-ds-muted">
                {section.title}
              </span>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {section.fields.map(renderField)}
              </div>
            </div>
          ))}
          {update.isError && (
            <span className="text-[13px] text-ds-red">
              No se pudo guardar: {update.error.message}
            </span>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-ds-border px-6 py-4">
          <Button variant="secondary" onClick={onClose} disabled={update.isPending}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={update.isPending}
            onClick={() => update.mutate({ id, patch: form })}
          >
            {update.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </div>
  );
}
