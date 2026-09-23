/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * One document tile: loads its bytes only when present, shows an image
 * preview or a file icon, and opens the file in a new tab on click.
 */
import { FileText, ImageOff } from "lucide-react";
import { trpc } from "../../../lib/trpc";

interface DocThumbProps {
  label: string;
  present: boolean;
  /** Cédula slot. */
  applicationId?: string;
  side?: "FRONT" | "BACK";
  /** Signed contract. */
  contract?: boolean;
  /** Evidence document. */
  documentId?: string;
  mimeType?: string;
}

function useDocData(p: DocThumbProps): { dataBase64?: string; mimeType?: string } {
  const id = trpc.getIdImage.useQuery(
    { id: p.applicationId ?? "", side: p.side ?? "FRONT" },
    { enabled: p.present && Boolean(p.side && p.applicationId), staleTime: Infinity }
  );
  const doc = trpc.getApplicationDocument.useQuery(
    { documentId: p.documentId ?? "" },
    { enabled: p.present && Boolean(p.documentId), staleTime: Infinity }
  );
  const contract = trpc.getApplicationContract.useQuery(
    { id: p.applicationId ?? "" },
    { enabled: p.present && Boolean(p.contract && p.applicationId), staleTime: Infinity }
  );
  if (p.side) return { dataBase64: id.data?.dataBase64, mimeType: id.data?.mimeType };
  if (p.documentId) return { dataBase64: doc.data?.dataBase64, mimeType: p.mimeType };
  if (p.contract) return { dataBase64: contract.data?.dataBase64, mimeType: "application/pdf" };
  return {};
}

export function DocThumb(props: DocThumbProps) {
  const { dataBase64, mimeType } = useDocData(props);
  const isImage = mimeType?.startsWith("image/");
  const href = dataBase64 && mimeType ? `data:${mimeType};base64,${dataBase64}` : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-[6px]" data-testid="doc-thumb">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => {
          if (!href) e.preventDefault();
        }}
        className={
          props.present
            ? "flex h-16 items-center justify-center overflow-hidden rounded-[8px] bg-[#E3E9F2]"
            : "flex h-16 items-center justify-center rounded-[8px] border border-dashed border-[#E5EAF1] bg-white"
        }
      >
        {props.present && isImage && href ? (
          <img src={href} alt={props.label} className="h-full w-full object-cover" />
        ) : props.present ? (
          <FileText size={18} className="text-[#8A9AB3]" />
        ) : (
          <ImageOff size={18} className="text-[#697A93]" />
        )}
      </a>
      <span className="truncate text-[10.5px] font-medium text-[#697A93]">{props.label}</span>
    </div>
  );
}
