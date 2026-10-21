/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Contrato: generate the new loan's contract from the stored terms (it never
 * mentions what is owed on the old loan), download it, and attach the signed
 * copy. Changing the terms later clears both.
 */
import { useState } from "react";
import { Download, FileCheck, FileText, RefreshCw } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { useToast } from "../../components/ui/ToastProvider";
import { friendlyError } from "../../lib/applications";
import { Btn, SectionLabel } from "../applications/ui";
import { readFileBase64 } from "../applications/helpers";
import { FileDropZone } from "../customers/FileDropZone";
import { Callout } from "./Callout";
import { canDo } from "./helpers";
import { saveBase64File } from "./download";
import type { RenewalViewProps } from "./types";

const when = (d: Date | string | null) =>
  d
    ? new Date(d).toLocaleString("es-DO", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "";

export function ContractView({ renewal, viewer, refresh }: RenewalViewProps) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const [busy, setBusy] = useState<"generate" | "download" | "sign" | null>(null);
  const generate = trpc.generateRenewalContract.useMutation();
  const sign = trpc.uploadRenewalSignedContract.useMutation();

  const canGenerate = canDo(renewal, viewer, "generateContract").ok;
  const canSign = canDo(renewal, viewer, "uploadSignedContract").ok;
  const hasContract = Boolean(renewal.contractFilename);
  const hasSigned = Boolean(renewal.signedContractFilename);

  async function onGenerate() {
    setBusy("generate");
    try {
      const out = await generate.mutateAsync({ id: renewal.id });
      await saveBase64File(out.contract, toast);
      await refresh();
    } catch (e) {
      toast.error(friendlyError(e, "No se pudo generar el contrato."));
    } finally {
      setBusy(null);
    }
  }

  async function onDownload() {
    setBusy("download");
    try {
      const contract = await utils.getRenewalContract.fetch({ id: renewal.id });
      await saveBase64File(contract, toast);
    } catch (e) {
      toast.error(friendlyError(e, "No se pudo descargar el contrato."));
    } finally {
      setBusy(null);
    }
  }

  async function onSigned(files: File[]) {
    const file = files[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("El contrato firmado debe ser un PDF.");
      return;
    }
    setBusy("sign");
    try {
      await sign.mutateAsync({
        id: renewal.id,
        originalName: file.name,
        mimeType: "application/pdf",
        dataBase64: await readFileBase64(file)
      });
      toast.success("Contrato firmado adjuntado. La renovación está lista para finalizar.");
      await refresh();
    } catch (e) {
      toast.error(friendlyError(e, "No se pudo subir el contrato firmado."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-[22px]" data-testid="renewal-contract">
      <div className="flex flex-col gap-[12px]">
        <SectionLabel>CONTRATO DEL PRÉSTAMO NUEVO</SectionLabel>
        {hasContract ? (
          <div
            data-testid="renewal-contract-card"
            className="flex items-center gap-3 rounded-[10px] border border-ds-border bg-ds-surface px-4 py-[14px]"
          >
            <FileText size={22} className="shrink-0 text-brand-blue-primary" />
            <div className="flex min-w-0 flex-col gap-[3px]">
              <span className="text-[13px] font-semibold text-brand-ink">
                Contrato — {renewal.customer.name}
              </span>
              <span className="text-[11px] font-medium text-ds-muted">
                Generado {when(renewal.contractGeneratedAt)} con los términos de la renovación · no
                menciona lo que debe el préstamo viejo
              </span>
            </div>
          </div>
        ) : (
          <p className="text-[12px] font-medium text-ds-muted">
            Todavía no hay contrato. Se genera con los términos que definiste.
          </p>
        )}
        <div className="flex items-center gap-[10px]">
          {!hasContract && (
            <Btn
              tone="primary"
              icon={FileText}
              disabled={!canGenerate || busy !== null}
              onClick={() => void onGenerate()}
              data-testid="renewal-generate-contract"
            >
              Generar contrato
            </Btn>
          )}
          {hasContract && (
            <>
              <Btn
                tone="primary"
                icon={Download}
                disabled={busy !== null}
                onClick={() => void onDownload()}
                data-testid="renewal-download-contract"
              >
                Descargar contrato
              </Btn>
              <Btn
                icon={RefreshCw}
                disabled={!canGenerate || busy !== null}
                onClick={() => void onGenerate()}
                data-testid="renewal-regenerate-contract"
              >
                Regenerar
              </Btn>
            </>
          )}
        </div>
      </div>

      {hasContract && !hasSigned && (
        <Callout tone="warn" title="Si cambias los términos">
          El contrato se borra y vuelves a Borrador: el firmado tiene que coincidir con los términos
          finales.
        </Callout>
      )}

      <div className="flex flex-col gap-[12px]">
        <SectionLabel>CONTRATO FIRMADO</SectionLabel>
        {hasSigned && (
          <div
            data-testid="renewal-signed-card"
            className="flex items-center gap-3 rounded-[10px] bg-ds-green-bg px-[14px] py-[12px]"
          >
            <FileCheck size={20} className="shrink-0 text-ds-green" />
            <div className="flex min-w-0 flex-col gap-[2px]">
              <span className="text-[13px] font-semibold text-brand-ink">
                Contrato firmado adjuntado
              </span>
              <span className="text-[11px] font-medium text-ds-muted">
                Si lo reemplazas, el nuevo archivo sustituye al anterior.
              </span>
            </div>
          </div>
        )}
        <FileDropZone
          title={hasSigned ? "Reemplazar el contrato firmado" : "Sube el contrato firmado"}
          subtitle="Solo PDF · lo recibes del cliente firmado y escaneado"
          accept="application/pdf"
          busy={busy === "sign"}
          disabled={!canSign}
          onFiles={(f) => void onSigned(f)}
          testId="renewal-signed-upload"
        />
        {!hasContract && (
          <p className="text-[11px] font-medium text-ds-muted">
            Genera el contrato primero: el firmado tiene que ser una copia de este.
          </p>
        )}
      </div>
    </div>
  );
}
