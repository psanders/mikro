/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The dashed "drop a file or click to choose" target used by the customer
 * profile and the renewal panel (Pencil EzobQ sec-12). Presentational: it hands
 * the chosen files to `onFiles`; the caller reads and uploads them.
 */
import { useRef, useState, type DragEvent } from "react";
import { Loader2, Upload } from "lucide-react";
import { cn } from "../../lib/cn";

export interface FileDropZoneProps {
  title: string;
  subtitle: string;
  /** `accept` attribute for the hidden input (e.g. "application/pdf"). */
  accept: string;
  multiple?: boolean;
  busy?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  /** Prefix for data-testid: `<id>` (the zone) and `<id>-input` (the input). */
  testId: string;
  /** Extra control rendered at the right (e.g. the document-type select). */
  extra?: React.ReactNode;
}

export function FileDropZone({
  title,
  subtitle,
  accept,
  multiple,
  busy,
  disabled,
  onFiles,
  testId,
  extra
}: FileDropZoneProps) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function pick(files: FileList | null) {
    if (!files || files.length === 0 || disabled || busy) return;
    onFiles(Array.from(files));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    pick(e.dataTransfer.files);
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[10px] border border-dashed bg-ds-subtle px-4 py-[14px]",
        over ? "border-brand-blue-primary bg-brand-mist" : "border-ds-border",
        disabled && "opacity-50"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <button
        type="button"
        data-testid={testId}
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        {busy ? (
          <Loader2 size={18} className="shrink-0 animate-spin text-brand-blue-primary" />
        ) : (
          <Upload size={18} className="shrink-0 text-brand-blue-primary" />
        )}
        <span className="flex min-w-0 flex-col gap-[2px]">
          <span className="text-[13px] font-semibold text-brand-ink">{title}</span>
          <span className="text-[11px] font-medium text-ds-muted">{subtitle}</span>
        </span>
      </button>
      {extra}
      <input
        ref={input}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        data-testid={`${testId}-input`}
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
