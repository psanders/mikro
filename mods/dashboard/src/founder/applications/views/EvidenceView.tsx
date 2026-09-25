/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Evidence (Pencil i7Umh; location field b4u6j6): the business location as a
 * pasted Google Maps link (required), the cédula's two fixed slots, business
 * photos (as many as needed; the minimum comes from the server), and optional
 * other documents. Collectors can also fill these from the field app. Each file is saved as it is picked; everything is locked once the
 * application goes to decision (the server refuses writes outside IN_REVIEW).
 */
import { useRef, useState } from "react";
import {
  CircleDashed,
  ExternalLink,
  ImageUp,
  Info,
  MapPin,
  Paperclip,
  Plus,
  Trash2
} from "lucide-react";
import { isMapUrl } from "@mikro/common/schemas";
import { trpc } from "../../../lib/trpc";
import { useToast } from "../../../components/ui/ToastProvider";
import { friendlyError } from "../../../lib/applications";
import { cn } from "../../../lib/cn";
import { SidePanel } from "../../components/SidePanel";
import { readFileBase64, useApplicationInvalidation } from "../helpers";
import { Btn, INPUT_CLASS, SectionLabel } from "../ui";
import { DocThumb } from "./DocThumb";
import type { ViewProps } from "./types";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];
const SUGGESTED_LABELS = ["Fachada", "Interior", "Mercancía", "Letrero", "Caja / mostrador"];

export function EvidenceView({ app, evidence, viewer, onView, panel }: ViewProps) {
  const toast = useToast();
  const invalidate = useApplicationInvalidation();
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const photosInput = useRef<HTMLInputElement>(null);
  const otherInput = useRef<HTMLInputElement>(null);
  const writable = app.status === "IN_REVIEW" && app.assignedReviewerId === viewer.id;

  const uploadId = trpc.uploadIdImage.useMutation();
  const uploadDoc = trpc.uploadApplicationDocument.useMutation();
  const deleteDoc = trpc.deleteApplicationDocument.useMutation();
  const setMapUrl = trpc.setApplicationMapUrl.useMutation();

  /** Run a write; resolves true when it succeeded (errors are shown as a toast). */
  async function run(task: () => Promise<unknown>, ok: string): Promise<boolean> {
    setBusy(true);
    try {
      await task();
      toast.success(ok);
      return true;
    } catch (e) {
      toast.error(friendlyError(e, "No se pudo guardar el archivo."));
      return false;
    } finally {
      setBusy(false);
      await invalidate(app.id);
    }
  }

  async function pickSide(side: "FRONT" | "BACK", file: File | undefined) {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type as ImageType)) {
      toast.error("La cédula debe ser una imagen JPG, PNG o WebP.");
      return;
    }
    await run(
      async () =>
        uploadId.mutateAsync({
          id: app.id,
          side,
          originalName: file.name,
          mimeType: file.type as ImageType,
          dataBase64: await readFileBase64(file)
        }),
      side === "FRONT" ? "Frente de la cédula guardado." : "Reverso de la cédula guardado."
    );
  }

  async function pickDocs(kind: "BUSINESS_PHOTO" | "OTHER", files: FileList | null) {
    if (!files?.length) return;
    await run(
      async () => {
        for (const file of Array.from(files)) {
          await uploadDoc.mutateAsync({
            id: app.id,
            kind,
            label: kind === "BUSINESS_PHOTO" ? label || undefined : file.name,
            originalName: file.name,
            mimeType: file.type as ImageType | "application/pdf",
            dataBase64: await readFileBase64(file)
          });
        }
      },
      files.length > 1 ? `${files.length} archivos guardados.` : "Archivo guardado."
    );
    setLabel("");
  }

  const status = evidence.status;
  const photos = evidence.documents.filter((d) => d.kind === "BUSINESS_PHOTO");
  const others = evidence.documents.filter((d) => d.kind === "OTHER");
  const missing: string[] = [];
  if (!status.location) missing.push("ubicación");
  if (!status.idFront) missing.push("cédula (frente)");
  if (!status.idBack) missing.push("cédula (reverso)");
  const needPhotos = status.businessPhotos.need - status.businessPhotos.have;
  if (needPhotos > 0) missing.push(`${needPhotos} foto${needPhotos > 1 ? "s" : ""} del negocio`);

  const footer = (
    <>
      <span
        className={cn(
          "flex flex-1 items-center gap-[6px] text-[12px] font-semibold",
          missing.length ? "text-[#D97706]" : "text-[#16A34A]"
        )}
        data-testid="evidence-pending"
      >
        <CircleDashed size={14} />
        {missing.length ? `Falta: ${missing.join(" · ")}` : "Evidencia completa"}
      </span>
      <Btn tone="primary" onClick={() => onView("detail")}>
        Listo
      </Btn>
    </>
  );

  const slot = (side: "FRONT" | "BACK", present: boolean) => (
    <div className="flex flex-1 flex-col gap-2">
      <SlotHeader label={side === "FRONT" ? "Frente" : "Reverso"} done={present} />
      {present ? (
        <div className="flex flex-col gap-2">
          <DocThumb label="" applicationId={app.id} side={side} present />
          {writable && (
            <FilePick
              accept={IMAGE_TYPES.join(",")}
              onPick={(f) => pickSide(side, f?.[0])}
              disabled={busy}
            >
              Reemplazar
            </FilePick>
          )}
        </div>
      ) : (
        <DropZone
          disabled={!writable || busy}
          accept={IMAGE_TYPES.join(",")}
          onPick={(f) => pickSide(side, f?.[0])}
          testId={`evidence-slot-${side.toLowerCase()}`}
        />
      )}
    </div>
  );

  return (
    <SidePanel open {...panel} footer={footer}>
      <div className="flex flex-col gap-6" data-testid="evidence-view">
        {!writable && (
          <p className="rounded-[8px] bg-[#EEF3F9] p-3 text-[12px] font-medium text-[#697A93]">
            La evidencia solo la sube el evaluador asignado mientras la solicitud está en
            evaluación.
          </p>
        )}

        <LocationSection
          mapUrl={app.mapUrl ?? null}
          writable={writable}
          busy={busy}
          onSave={(mapUrl) =>
            run(
              () => setMapUrl.mutateAsync({ id: app.id, mapUrl }),
              mapUrl ? "Ubicación guardada." : "Ubicación quitada."
            )
          }
        />

        <section className="flex flex-col gap-3">
          <SectionLabel
            extra={
              <Counter
                ok={status.idFront && status.idBack}
              >{`${Number(status.idFront) + Number(status.idBack)} de 2`}</Counter>
            }
          >
            Cédula · 2 espacios fijos
          </SectionLabel>
          <div className="flex gap-[14px]">
            {slot("FRONT", status.idFront)}
            {slot("BACK", status.idBack)}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel
            extra={
              <Counter
                ok={needPhotos <= 0}
              >{`${status.businessPhotos.have} · mínimo ${status.businessPhotos.need}`}</Counter>
            }
          >
            Fotos del negocio
          </SectionLabel>
          <div className="grid grid-cols-4 gap-3">
            {photos.map((d) => (
              <div key={d.id} className="relative">
                <DocThumb
                  label={d.label || "Foto"}
                  documentId={d.id}
                  mimeType={d.mimeType}
                  present
                />
                {writable && (
                  <RemoveButton
                    onClick={() =>
                      run(() => deleteDoc.mutateAsync({ documentId: d.id }), "Foto quitada.")
                    }
                  />
                )}
              </div>
            ))}
            {writable && (
              <button
                type="button"
                disabled={busy}
                onClick={() => photosInput.current?.click()}
                data-testid="evidence-add-photos"
                className="flex h-16 flex-col items-center justify-center gap-1 rounded-[8px] border-[1.5px] border-dashed border-[#E5EAF1] bg-[#F4F7FB] text-[11px] font-semibold text-[#697A93] hover:border-[#7C3AED] hover:text-[#7C3AED]"
              >
                <Plus size={16} />
                Agregar
              </button>
            )}
          </div>
          <input
            ref={photosInput}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            multiple
            hidden
            data-testid="evidence-photos-input"
            onChange={(e) => {
              void pickDocs("BUSINESS_PHOTO", e.target.files);
              e.target.value = "";
            }}
          />
          {writable && (
            <div className="flex flex-wrap items-center gap-[6px]">
              <span className="text-[11.5px] font-medium text-[#697A93]">Etiqueta:</span>
              {SUGGESTED_LABELS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setLabel(label === s ? "" : s)}
                  className={cn(
                    "rounded-full border px-[9px] py-[3px] text-[11.5px] font-medium",
                    label === s
                      ? "border-[#7C3AED] bg-[#FAF7FF] text-[#7C3AED]"
                      : "border-[#E5EAF1] text-[#14254A]"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel
            extra={<span className="text-[11px] font-semibold text-[#697A93]">opcional</span>}
          >
            Otros documentos
          </SectionLabel>
          {others.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-2 rounded-[8px] border border-[#E5EAF1] px-3 py-2"
            >
              <Paperclip size={14} className="text-[#697A93]" />
              <span className="flex-1 truncate text-[12.5px] font-medium text-[#14254A]">
                {d.originalName}
              </span>
              {writable && (
                <button
                  type="button"
                  aria-label="Quitar"
                  onClick={() =>
                    run(() => deleteDoc.mutateAsync({ documentId: d.id }), "Documento quitado.")
                  }
                  className="text-[#697A93] hover:text-[#DC2626]"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {writable && (
            <button
              type="button"
              disabled={busy}
              onClick={() => otherInput.current?.click()}
              className={cn(INPUT_CLASS, "flex items-center gap-2 text-left text-[#697A93]")}
            >
              <Paperclip size={15} />
              Agregar documento — recibo de luz, contrato de alquiler, RNC…
            </button>
          )}
          <input
            ref={otherInput}
            type="file"
            accept={[...IMAGE_TYPES, "application/pdf"].join(",")}
            multiple
            hidden
            onChange={(e) => {
              void pickDocs("OTHER", e.target.files);
              e.target.value = "";
            }}
          />
        </section>

        <div className="flex gap-2 rounded-[8px] bg-[#EEF3F9] p-3 text-[12px] font-medium leading-[1.4] text-[#697A93]">
          <Info size={14} className="mt-[1px] shrink-0" />
          Cada archivo se guarda al subirlo. Puedes volver y agregar más mientras la solicitud esté
          en evaluación; al enviarla a decisión la evidencia queda fija.
        </div>
      </div>
    </SidePanel>
  );
}

/**
 * The business location: a pasted Google Maps link (collectors save it from GPS
 * in the field app). Only map links are accepted, so it always opens a map.
 */
function LocationSection({
  mapUrl,
  writable,
  busy,
  onSave
}: {
  mapUrl: string | null;
  writable: boolean;
  busy: boolean;
  /** Resolves true when saved; on failure the pasted link is kept for a retry. */
  onSave: (mapUrl: string | null) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const value = draft.trim();
  const invalid = value !== "" && !isMapUrl(value);
  const showInput = writable && (!mapUrl || editing);

  async function save() {
    if (!value || invalid) return;
    if (!(await onSave(value))) return;
    setDraft("");
    setEditing(false);
  }

  return (
    <section className="flex flex-col gap-3" data-testid="evidence-location">
      <SectionLabel
        extra={<Counter ok={Boolean(mapUrl)}>{mapUrl ? "guardada" : "obligatoria"}</Counter>}
      >
        Ubicación del negocio
      </SectionLabel>
      {mapUrl && !editing && (
        <div className="flex items-center gap-2 rounded-[10px] border border-[#E5EAF1] px-3 py-[10px]">
          <MapPin size={15} className="shrink-0 text-[#16A34A]" />
          <span
            className="flex-1 truncate text-[12.5px] font-medium text-[#14254A]"
            data-testid="evidence-location-url"
          >
            {mapUrl}
          </span>
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[12px] font-semibold text-[#1F4AA8]"
          >
            <ExternalLink size={13} />
            Abrir en Maps
          </a>
          {writable && (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-[12px] font-semibold text-[#1F4AA8]"
              >
                Reemplazar
              </button>
              <button
                type="button"
                aria-label="Quitar ubicación"
                disabled={busy}
                onClick={() => void onSave(null)}
                className="text-[#697A93] hover:text-[#DC2626]"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      )}
      {showInput && (
        <>
          <div
            className={cn(
              "flex items-center gap-[10px] rounded-[10px] border px-[14px] py-[8px]",
              invalid ? "border-[#DC2626]" : "border-[#F5C98F]"
            )}
          >
            <MapPin size={15} className="shrink-0 text-[#697A93]" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void save()}
              placeholder="Pega el enlace de Google Maps del negocio"
              className="flex-1 bg-transparent text-[12.5px] font-medium text-[#14254A] outline-none placeholder:text-[#697A93]"
              data-testid="evidence-location-input"
            />
            <Btn
              tone="primary"
              className="px-3 py-[6px]"
              disabled={busy || !value || invalid}
              onClick={() => void save()}
              data-testid="evidence-location-save"
            >
              Guardar
            </Btn>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setDraft("");
                  setEditing(false);
                }}
                className="text-[12px] font-semibold text-[#697A93]"
              >
                Cancelar
              </button>
            )}
          </div>
          <p
            className={cn(
              "text-[12px] font-medium leading-[1.4]",
              invalid ? "text-[#DC2626]" : "text-[#697A93]"
            )}
          >
            {invalid
              ? "Solo se aceptan enlaces de Google Maps (maps.google.com, maps.app.goo.gl)."
              : "O la recoge un cobrador en el negocio con el GPS del teléfono."}
          </p>
        </>
      )}
      {!mapUrl && !writable && (
        <p className="text-[12px] font-medium text-[#D97706]">Sin ubicación todavía.</p>
      )}
    </section>
  );
}

function SlotHeader({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-[6px]">
      <span className="text-[12px] font-semibold text-[#697A93]">{label}</span>
      {done && <span className="text-[11px] font-semibold text-[#16A34A]">✓</span>}
    </div>
  );
}

function Counter({ ok, children }: { ok: boolean; children: string }) {
  return (
    <span className={cn("text-[11px] font-semibold", ok ? "text-[#16A34A]" : "text-[#D97706]")}>
      {children}
    </span>
  );
}

function DropZone({
  disabled,
  accept,
  onPick,
  testId
}: {
  disabled: boolean;
  accept: string;
  onPick: (files: FileList | null) => void;
  testId: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!disabled) onPick(e.dataTransfer.files);
        }}
        data-testid={testId}
        className="flex h-[130px] flex-col items-center justify-center gap-[6px] rounded-[10px] border-[1.5px] border-[#7C3AED] bg-[#FAF7FF] text-[11.5px] font-semibold text-[#7C3AED] disabled:border-[#E5EAF1] disabled:bg-[#F4F7FB] disabled:text-[#697A93]"
      >
        <ImageUp size={20} />
        Arrastra o haz clic
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        data-testid={`${testId}-input`}
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}

function FilePick({
  accept,
  onPick,
  disabled,
  children
}: {
  accept: string;
  onPick: (files: FileList | null) => void;
  disabled: boolean;
  children: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className="self-start text-[11px] font-semibold text-[#1F4AA8]"
      >
        {children}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Quitar"
      onClick={onClick}
      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[#697A93] shadow hover:text-[#DC2626]"
    >
      <Trash2 size={12} />
    </button>
  );
}
