/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { trpc } from "../lib/trpc";
import { Button } from "./ui/Button";
import { applyFormat, formatError } from "../lib/inputFormat";

interface Props {
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const inputCls =
  "w-full rounded-[8px] border border-ds-border bg-ds-surface px-[14px] py-[10px] text-sm font-medium text-brand-ink outline-none focus:border-brand-blue-sky";

export function SendPromoModal({ onClose, onSuccess, onError }: Props) {
  const [phone, setPhone] = useState("");

  const phoneError = phone.trim() !== "" ? formatError("phone", phone) : null;
  const phoneValid = phone.trim() !== "" && phoneError === null;

  const sendPromo = trpc.sendPromo.useMutation({
    onSuccess: (result) => {
      onClose();
      if (result.sent) {
        onSuccess("Promoción enviada");
      } else {
        onError(result.error ?? "No se pudo enviar la promoción");
      }
    },
    onError: (err) => {
      onClose();
      onError(err.message);
    }
  });

  const handleSubmit = () => {
    sendPromo.mutate({ phone });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="flex w-[420px] flex-col overflow-hidden rounded-[16px] bg-ds-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ds-border px-6 py-5">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-ds-green" />
            <span className="text-[18px] font-bold tracking-[-0.3px] text-brand-ink">
              Enviar Promoción
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-ds-muted hover:text-brand-ink">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-[6px]">
            <label className="text-[13px] font-medium text-brand-ink">Teléfono del prospecto</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="(000) 000-0000"
              className={`${inputCls} placeholder:text-ds-muted ${
                phoneError ? "border-ds-red focus:border-ds-red" : ""
              }`}
              value={phone}
              onChange={(e) => setPhone(applyFormat("phone", e.target.value))}
              autoFocus
            />
            {phoneError && (
              <span className="text-[12px] font-medium text-ds-red">{phoneError}</span>
            )}
          </div>
          <p className="text-[12px] leading-[1.4] text-ds-muted">
            Se enviará la plantilla de promoción por WhatsApp. Si el prospecto completa el
            formulario, aparecerá como una solicitud normal.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-ds-border px-6 py-4">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!phoneValid || sendPromo.isPending}
            onClick={handleSubmit}
          >
            {sendPromo.isPending ? "Enviando…" : "Enviar por WhatsApp"}
          </Button>
        </div>
      </div>
    </div>
  );
}
