/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The "Documento generado" card — rendered when the copilot's reply carries a
 * `document` (currently: an on-demand loan statement from `generateLoanStatement`).
 * A blue header band (file glyph, "Documento listo", filename) over a body
 * with a single "Descargar" action. Read-only by construction — there is
 * nothing to confirm/reject, unlike `PendingActionCard`; the only state is
 * whether the save has been attempted.
 */
import { FileText, Download } from "lucide-react";
import { cn } from "../../lib/cn";

export type DocumentDownloadStatus = "idle" | "saving" | "done" | "error";

export interface DocumentCardProps {
  filename: string;
  status: DocumentDownloadStatus;
  error?: string;
  onDownload: () => void;
  className?: string;
}

export function DocumentCard({
  filename,
  status,
  error,
  onDownload,
  className
}: DocumentCardProps) {
  const busy = status === "saving";
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-[12px] border border-ds-border bg-ds-surface",
        className
      )}
    >
      <div className="flex items-center gap-[10px] bg-brand-mist px-[14px] py-[11px]">
        <FileText size={16} strokeWidth={2} className="shrink-0 text-brand-blue-primary" />
        <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
          <span className="text-[13px] font-semibold text-brand-blue-primary">Documento listo</span>
          <span className="truncate text-[11px] font-medium text-brand-ink">{filename}</span>
        </div>
      </div>

      <div className="flex flex-col gap-[10px] px-[14px] py-[12px]">
        {status === "error" && error && (
          <p className="w-full text-[12px] font-medium leading-[18px] text-ds-red">{error}</p>
        )}
        <div className="flex flex-wrap items-center gap-[8px]">
          <button
            type="button"
            onClick={onDownload}
            disabled={busy}
            className={cn(
              "inline-flex w-fit items-center gap-[7px] rounded-[9px] border border-ds-border bg-ds-surface px-[14px] py-[8px] text-[14px] font-medium text-brand-ink transition",
              busy ? "cursor-not-allowed opacity-60" : "hover:bg-ds-bg"
            )}
          >
            <Download size={16} />
            {status === "done" ? "Descargar de nuevo" : busy ? "Guardando…" : "Descargar"}
          </button>
        </div>
      </div>
    </div>
  );
}
