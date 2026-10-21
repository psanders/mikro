/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Documentos: the signed contract plus any additional information (updated
 * cédula, business photo, receipts). While the renewal is open they belong to
 * it; at finalize they move to the new loan.
 */
import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { useToast } from "../../components/ui/ToastProvider";
import { friendlyError } from "../../lib/applications";
import { PanelSelect, SectionLabel } from "../applications/ui";
import { readFileBase64 } from "../applications/helpers";
import { CustomerDocTile } from "../customers/CustomerDocTile";
import { FileDropZone } from "../customers/FileDropZone";
import { ACCEPT_FILES, UPLOAD_TYPES, documentTypeLabel } from "../customers/labels";
import { canDo } from "./helpers";
import type { RenewalViewProps } from "./types";

export function DocumentsView({ renewal, viewer, refresh }: RenewalViewProps) {
  const toast = useToast();
  const docs = trpc.listCustomerDocuments.useQuery({ customerId: renewal.customer.id });
  const upload = trpc.uploadRenewalDocument.useMutation();
  const [type, setType] = useState<(typeof UPLOAD_TYPES)[number]>("OTHER");
  const [busy, setBusy] = useState(false);
  const canUpload = canDo(renewal, viewer, "uploadDocument").ok;
  const mine = (docs.data ?? []).filter((d) => d.renewalId === renewal.id);

  async function onFiles(files: File[]) {
    setBusy(true);
    try {
      for (const file of files) {
        await upload.mutateAsync({
          id: renewal.id,
          type,
          originalName: file.name,
          mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" | "application/pdf",
          dataBase64: await readFileBase64(file)
        });
      }
      toast.success(files.length === 1 ? "Documento agregado." : "Documentos agregados.");
      await refresh();
    } catch (e) {
      toast.error(friendlyError(e, "No se pudo subir el documento."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-[22px]" data-testid="renewal-documents">
      <div className="flex flex-col gap-[12px]">
        <SectionLabel>INFORMACIÓN ADICIONAL</SectionLabel>
        <FileDropZone
          title="Agrega documentos de soporte"
          subtitle="Imagen o PDF · cédula actualizada, foto del negocio, comprobantes"
          accept={ACCEPT_FILES}
          multiple
          busy={busy}
          disabled={!canUpload}
          onFiles={(f) => void onFiles(f)}
          testId="renewal-doc-upload"
          extra={
            <div className="w-[150px] shrink-0">
              <PanelSelect
                value={type}
                disabled={!canUpload}
                onChange={(e) => setType(e.target.value as (typeof UPLOAD_TYPES)[number])}
                aria-label="Tipo de documento"
              >
                {UPLOAD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {documentTypeLabel(t)}
                  </option>
                ))}
              </PanelSelect>
            </div>
          }
        />
      </div>

      <div className="flex flex-col gap-[12px]">
        <SectionLabel>{`DE ESTA RENOVACIÓN · ${mine.length}`}</SectionLabel>
        {docs.isPending && <p className="text-[12px] font-medium text-ds-muted">Cargando…</p>}
        {docs.data && mine.length === 0 && (
          <p className="text-[12px] font-medium text-ds-muted">
            Aún no hay documentos en esta renovación.
          </p>
        )}
        {mine.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {mine.map((d) => (
              <CustomerDocTile
                key={d.id}
                id={d.id}
                type={d.type}
                originalName={d.originalName}
                mimeType={d.mimeType}
                createdAt={d.createdAt}
                label={
                  d.filename === renewal.signedContractFilename
                    ? "Contrato firmado"
                    : d.filename === renewal.contractFilename
                      ? "Contrato (sin firmar)"
                      : undefined
                }
              />
            ))}
          </div>
        )}
        <p className="text-[11px] font-medium text-ds-muted">
          Al finalizar, estos archivos pasan al perfil del cliente, ligados al préstamo nuevo.
        </p>
      </div>
    </div>
  );
}
