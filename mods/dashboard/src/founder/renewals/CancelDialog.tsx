/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The cancel confirmation (Pencil EzobQ sec-12 C): nothing else was written
 * during the renewal, so cancelling only ends it. The old loan stays active.
 */
import { ArrowLeft, CircleX, X } from "lucide-react";
import { Btn } from "../applications/ui";

export function CancelDialog({
  loanNumber,
  customerName,
  busy,
  onBack,
  onConfirm
}: {
  loanNumber: number;
  customerName: string;
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-[#14254A33] px-6"
      data-testid="renewal-cancel-dialog"
    >
      <div
        role="alertdialog"
        aria-label="Cancelar la renovación"
        className="flex w-full max-w-[440px] flex-col gap-4 rounded-[16px] border border-ds-border bg-ds-surface p-6 shadow-[0_16px_40px_#14254A40]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-ds-red-bg text-ds-red">
            <CircleX size={19} />
          </span>
          <h3 className="text-[18px] font-semibold text-brand-ink">¿Cancelar la renovación?</h3>
        </div>
        <p className="text-[13px] font-medium leading-[1.45] text-brand-ink">
          El préstamo #{loanNumber} de {customerName} sigue activo y no se mueve dinero ni se crea
          ningún préstamo. Los documentos que subiste quedan guardados en su perfil. Podrás iniciar
          otra renovación cuando quieras.
        </p>
        <div className="flex justify-end gap-[10px]">
          <Btn icon={ArrowLeft} onClick={onBack} disabled={busy}>
            Volver
          </Btn>
          <Btn
            className="border-transparent bg-ds-red-solid text-white hover:bg-ds-red-solid"
            icon={X}
            onClick={onConfirm}
            disabled={busy}
            data-testid="renewal-cancel-confirm"
          >
            Cancelar renovación
          </Btn>
        </div>
      </div>
    </div>
  );
}
