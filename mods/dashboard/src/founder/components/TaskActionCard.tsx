/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The task action widget mounted inside an open task feed card (Pencil
 * "tareas states" board, screen `Idee2`): a context sentence built from the
 * firing's fire-time context, one input per pending ask slot, and
 * Confirmar / Omitir. Purely presentational — the container owns the tRPC
 * calls. Nothing here involves an LLM: confirm submits the founder's values
 * to the firing confirm endpoint, which executes catalog code.
 */
import { useState } from "react";
import { Check, Download } from "lucide-react";
import { cn } from "../../lib/cn";
import { formatAmount } from "./format";

/** One founder-suppliable slot, as served by tasks.getFiring. */
export interface TaskAskSlot {
  name: string;
  label: string;
  kind: "text" | "amount" | "collector" | "account" | "category";
  optional: boolean;
  /** Name of a gathered payload field whose value pre-fills this input (still editable). */
  defaultFrom?: string;
}

/** Presentational shape for an open firing (mapped from tasks.getFiring). */
export interface TaskFiringInfo {
  id: string;
  taskName: string;
  automationId: string;
  status: "READY" | "NEEDS_INPUT";
  askSlots: TaskAskSlot[];
  missingSlots: string[];
  /** Display-only fire-time context (week collected, day totals, …). */
  context: Record<string, unknown>;
  /** Gathered static/computed values — used only to seed ask-input defaults (e.g. suggestedAmount). */
  payload?: Record<string, unknown>;
  reason?: string | null;
}

/** An in-memory generated document from a resolved firing (e.g. the loan-statement PDF). */
export interface TaskResultAttachment {
  filename: string;
  mimeType: string;
  base64: string;
}

export interface TaskActionCardProps {
  firing: TaskFiringInfo;
  submitting?: boolean;
  /** Structured error from the last confirm/skip attempt, shown in place. */
  error?: string | null;
  onConfirm?: (values: Record<string, string>) => void;
  onSkip?: () => void;
  className?: string;
  /**
   * Present once confirm resolved with an in-memory document (e.g. the
   * loan-statement automation's PDF) — the card renders a download action
   * instead of the confirm/skip form. The bytes never touch the event log;
   * they only ever live in the confirm mutation's result.
   */
  resultAttachment?: TaskResultAttachment | null;
  onDownloadAttachment?: () => void;
}

/**
 * Spanish context sentence from the firing's fire-time context — automation
 * aware where the context fields are known, generic otherwise.
 */
export function contextSentence(firing: TaskFiringInfo): string | null {
  const ctx = firing.context;
  const num = (k: string) => (typeof ctx[k] === "number" ? (ctx[k] as number) : null);
  const str = (k: string) => (typeof ctx[k] === "string" ? (ctx[k] as string) : "");

  const weekCollected = num("weekCollected");
  if (weekCollected !== null) {
    const who = str("collectorName");
    const count = num("weekPayments");
    return `Esta semana ${who || "el cobrador"} cobró ${formatAmount(weekCollected)}${
      count !== null ? ` en ${count} pago(s)` : ""
    }.`;
  }

  const dayCollected = num("dayCollected");
  if (dayCollected !== null) {
    const closeDate = str("closeDate");
    const count = num("dayPayments");
    return `Cobranza del ${closeDate || "día"}: ${formatAmount(dayCollected)}${
      count !== null ? ` en ${count} pago(s)` : ""
    }.`;
  }

  return null;
}

const INPUT_CLASS =
  "w-full rounded-[8px] border border-[#E5EAF1] bg-white px-[14px] py-[10px] text-[14px] font-medium text-[#14254A] placeholder:text-[#697A93] focus:border-[#1F4AA8] focus:outline-none";

export function TaskActionCard({
  firing,
  submitting = false,
  error,
  onConfirm,
  onSkip,
  className,
  resultAttachment,
  onDownloadAttachment
}: TaskActionCardProps) {
  // Any ask slot may declare `defaultFrom`, naming a gathered payload field
  // whose value pre-fills its input (still freely editable) — e.g. payment's
  // ask `amount` defaults from its static `suggestedAmount` slot.
  const [values, setValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    for (const slot of firing.askSlots) {
      if (!slot.defaultFrom) continue;
      const value = firing.payload?.[slot.defaultFrom];
      if (typeof value === "number" || typeof value === "string") {
        defaults[slot.name] = String(value);
      }
    }
    return defaults;
  });

  // A resolved firing that produced an in-memory document (loan-statement)
  // renders only the download action — confirm/skip no longer apply.
  if (resultAttachment) {
    return (
      <div className={cn("flex flex-col gap-[12px]", className)}>
        <button
          type="button"
          onClick={onDownloadAttachment}
          className="inline-flex w-fit items-center gap-[7px] rounded-[9px] bg-[#1F4AA8] px-[16px] py-[9px] text-[14px] font-medium text-white transition hover:bg-[#1A3F8F]"
        >
          <Download size={16} />
          Descargar estado de cuenta
        </button>
      </div>
    );
  }

  const sentence = contextSentence(firing);
  const needsInput = firing.status === "NEEDS_INPUT";

  function setValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  return (
    <div className={cn("flex flex-col gap-[12px]", className)}>
      {needsInput && (
        <p className="text-[12px] font-semibold leading-tight text-[#D97706]">
          {firing.reason
            ? firing.reason
            : firing.missingSlots.length > 0
              ? `Falta información: ${firing.missingSlots.join(", ")}.`
              : "Esta tarea necesita revisión."}
        </p>
      )}

      {sentence && (
        <p className="text-[13px] font-medium leading-[1.4] text-[#14254A]">{sentence}</p>
      )}

      {firing.askSlots.length > 0 && (
        <div className="flex flex-wrap items-end gap-[10px]">
          {firing.askSlots.map((slot) => (
            <label key={slot.name} className="flex flex-col gap-[7px]">
              <span className="text-[13px] font-medium text-[#14254A]">{slot.label}</span>
              <input
                type={slot.kind === "amount" ? "number" : "text"}
                inputMode={slot.kind === "amount" ? "decimal" : undefined}
                min={slot.kind === "amount" ? 1 : undefined}
                value={values[slot.name] ?? ""}
                onChange={(e) => setValue(slot.name, e.target.value)}
                disabled={submitting}
                placeholder={slot.optional ? "Opcional" : ""}
                className={cn(INPUT_CLASS, slot.kind === "amount" ? "w-[180px]" : "w-[240px]")}
              />
            </label>
          ))}
        </div>
      )}

      {error && <p className="text-[12px] font-semibold leading-tight text-[#DC2626]">{error}</p>}

      <div className="flex flex-wrap items-center gap-[10px]">
        <button
          type="button"
          disabled={submitting}
          onClick={() => onConfirm?.(values)}
          className={cn(
            "inline-flex items-center gap-[7px] rounded-[9px] bg-[#1F4AA8] px-[16px] py-[9px] text-[14px] font-medium text-white transition hover:bg-[#1A3F8F]",
            submitting && "cursor-not-allowed opacity-60 hover:bg-[#1F4AA8]"
          )}
        >
          <Check size={16} />
          {submitting ? "Confirmando…" : "Confirmar"}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => onSkip?.()}
          className={cn(
            "inline-flex items-center rounded-[9px] border border-[#E5EAF1] bg-white px-[16px] py-[9px] text-[14px] font-medium text-[#14254A] transition hover:bg-[#F4F7FB]",
            submitting && "cursor-not-allowed opacity-60 hover:bg-white"
          )}
        >
          Omitir
        </button>
      </div>
    </div>
  );
}
