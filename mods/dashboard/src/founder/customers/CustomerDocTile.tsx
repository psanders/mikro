/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * One customer document: an image preview or a file icon, its type and date,
 * opening the file in a new tab. Admins get a delete button (reviewers do not).
 */
import { FileText, Trash2 } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { documentTypeLabel } from "./labels";

export interface CustomerDocTileProps {
  id: string;
  type: string;
  originalName?: string | null;
  mimeType?: string | null;
  createdAt: Date | string;
  onDelete?: () => void;
}

const date = (d: Date | string) =>
  new Date(d).toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric" });

export function CustomerDocTile({
  id,
  type,
  originalName,
  mimeType,
  createdAt,
  onDelete
}: CustomerDocTileProps) {
  const file = trpc.getCustomerDocument.useQuery({ id }, { staleTime: Infinity });
  const mime = file.data?.mimeType ?? mimeType ?? undefined;
  const href = file.data && mime ? `data:${mime};base64,${file.data.dataBase64}` : undefined;
  const isImage = mime?.startsWith("image/");

  return (
    <div className="flex min-w-0 flex-col gap-[6px]" data-testid="customer-doc" data-type={type}>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => {
          if (!href) e.preventDefault();
        }}
        className="flex h-16 items-center justify-center overflow-hidden rounded-[8px] border border-ds-border bg-ds-subtle"
      >
        {isImage && href ? (
          <img src={href} alt={originalName ?? type} className="h-full w-full object-cover" />
        ) : (
          <FileText size={22} className="text-ds-muted" />
        )}
      </a>
      <span
        className="truncate text-[11px] font-semibold text-brand-ink"
        title={originalName ?? ""}
      >
        {documentTypeLabel(type)}
      </span>
      <span className="flex items-center justify-between gap-1 text-[10px] font-medium text-ds-muted">
        {date(createdAt)}
        {onDelete && (
          <button
            type="button"
            aria-label="Eliminar documento"
            data-testid="customer-doc-delete"
            onClick={onDelete}
            className="text-ds-muted hover:text-ds-red"
          >
            <Trash2 size={12} />
          </button>
        )}
      </span>
    </div>
  );
}
