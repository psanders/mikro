/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Inline rejection ("Rechazar…"): a reason from the fixed list, and a note
 * that is required only for "Otro". The reason feeds the ad-quality report.
 */
import { useState } from "react";
import { REJECTION_REASON_LABELS, type RejectionReason } from "@mikro/common/schemas";
import { trpc } from "../../lib/trpc";
import { useToast } from "../../components/ui/ToastProvider";
import { friendlyError } from "../../lib/applications";
import { useApplicationInvalidation } from "./helpers";
import { Btn, INPUT_CLASS } from "./ui";

// Out-of-area is normally set by intake, but a person may find it too.
const REASONS: RejectionReason[] = [
  "PAYMENT_CAPACITY",
  "DOCUMENTS",
  "OUT_OF_COVERAGE_AREA",
  "OTHER"
];

export function RejectForm({
  applicationId,
  onDone
}: {
  applicationId: string;
  /** Kept for call-site clarity; the server decides who may reject. */
  reasonsFor?: "reviewer" | "admin";
  onDone: () => void;
}) {
  const toast = useToast();
  const invalidate = useApplicationInvalidation();
  const [reason, setReason] = useState<RejectionReason | "">("");
  const [note, setNote] = useState("");
  const reject = trpc.rejectApplication.useMutation({
    onSuccess: async () => {
      toast.success("Solicitud rechazada · pasó a Cerradas.");
      await invalidate(applicationId);
      onDone();
    },
    onError: (e) => toast.error(friendlyError(e, "No se pudo rechazar."))
  });
  const ready = reason !== "" && (reason !== "OTHER" || note.trim().length > 0);

  return (
    <div
      className="flex flex-col gap-3 rounded-[12px] border border-[#FCEBEB] bg-white p-3"
      data-testid="reject-form"
    >
      <span className="text-[13px] font-semibold text-[#14254A]">Rechazar solicitud</span>
      <div className="flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            data-testid={`reject-reason-${r}`}
            className={
              reason === r
                ? "rounded-full border border-[#DC2626] bg-[#FCEBEB] px-3 py-1 text-[12px] font-semibold text-[#DC2626]"
                : "rounded-full border border-[#E5EAF1] px-3 py-1 text-[12px] font-medium text-[#14254A]"
            }
          >
            {REJECTION_REASON_LABELS[r]}
          </button>
        ))}
      </div>
      <input
        className={INPUT_CLASS}
        placeholder={reason === "OTHER" ? "Nota (obligatoria)" : "Nota (opcional)"}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        data-testid="reject-note"
      />
      <div className="flex items-center gap-2">
        <Btn
          className="border-[#DC2626] text-[#DC2626]"
          disabled={!ready || reject.isPending}
          onClick={() =>
            reject.mutate({
              id: applicationId,
              reason: reason as RejectionReason,
              note: note.trim() || undefined
            })
          }
          data-testid="reject-confirm"
        >
          Confirmar rechazo
        </Btn>
        <Btn onClick={onDone}>Cancelar</Btn>
      </div>
    </div>
  );
}
