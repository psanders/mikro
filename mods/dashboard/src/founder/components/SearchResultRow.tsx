/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Result rows for the founder /buscar screen (Pencil "Búsqueda"). `cliente`
 * and `prestamo` render as standalone cards; `evento` renders as a compact row
 * meant to sit inside a shared bordered list container (see BusquedaScreen).
 */
import { Banknote } from "lucide-react";
import { cn } from "../../lib/cn";
import { FeedTypeIcon } from "./FeedTypeIcon";
import { formatRelativeTime } from "./format";
import type { FeedEvent } from "./types";

type BadgeTone = "green" | "amber" | "red" | "neutral";

const STATUS_CHIP: Record<BadgeTone, string> = {
  green: "bg-[#E8F7EE] text-[#16A34A]",
  amber: "bg-[#FDF1E3] text-[#D97706]",
  red: "bg-[#FCEBEB] text-[#DC2626]",
  neutral: "bg-[#EEF3F9] text-[#697A93]"
};

interface ClienteRowProps {
  variant: "cliente";
  name: string;
  phone?: string;
  idNumber?: string;
  onSelect: () => void;
  className?: string;
}

interface PrestamoRowProps {
  variant: "prestamo";
  loanNumber: number | string;
  customerName: string;
  statusLabel?: string;
  statusTone?: BadgeTone;
  onSelect: () => void;
  className?: string;
}

interface EventoRowProps {
  variant: "evento";
  event: FeedEvent;
  /** True for every row after the first — draws the top divider inside the list. */
  divider?: boolean;
  onSelect: () => void;
  className?: string;
}

export type SearchResultRowProps = ClienteRowProps | PrestamoRowProps | EventoRowProps;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const CARD =
  "flex w-full items-center gap-4 rounded-[14px] border border-[#E5EAF1] bg-white p-[16px_18px] text-left transition hover:border-[#1F4AA8]/40";
const VER_BUTTON =
  "shrink-0 rounded-[9px] border border-[#E5EAF1] bg-white px-4 py-[9px] text-[14px] font-medium text-[#14254A] transition hover:bg-[#F4F7FB]";

function ClienteRow({ name, phone, idNumber, onSelect, className }: ClienteRowProps) {
  const meta = [phone, idNumber && `Cédula ${idNumber}`].filter(Boolean).join(" · ");
  return (
    <div className={cn(CARD, className)}>
      <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-[#E9F2FF] text-[16px] font-bold text-[#1F4AA8]">
        {initialsOf(name)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-[16px] font-semibold text-[#14254A]">{name}</p>
        {meta && <p className="truncate text-[12px] font-medium text-[#697A93]">{meta}</p>}
      </div>
      <button type="button" onClick={onSelect} className={VER_BUTTON}>
        Ver perfil
      </button>
    </div>
  );
}

function PrestamoRow({
  loanNumber,
  customerName,
  statusLabel,
  statusTone = "neutral",
  onSelect,
  className
}: PrestamoRowProps) {
  return (
    <div className={cn(CARD, "p-[14px_18px]", className)}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[#EEF3F9] text-[#697A93]">
        <Banknote size={18} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-[14px] font-semibold text-[#14254A]">
          #{loanNumber}
          {customerName ? ` — ${customerName}` : ""}
        </p>
        {statusLabel && (
          <span
            className={cn(
              "w-fit rounded-full px-[10px] py-[3px] text-[11px] font-semibold",
              STATUS_CHIP[statusTone]
            )}
          >
            {statusLabel}
          </span>
        )}
      </div>
      <button type="button" onClick={onSelect} className={VER_BUTTON}>
        Ver préstamo
      </button>
    </div>
  );
}

function EventoRow({ event, divider, onSelect, className }: EventoRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 p-[11px_16px] text-left transition hover:bg-[#F4F7FB]",
        divider && "border-t border-[#E5EAF1]",
        className
      )}
    >
      <FeedTypeIcon event={event} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
        <p className="truncate text-[13px] font-semibold text-[#14254A]">{event.summary}</p>
        <p className="truncate text-[11px] font-medium text-[#697A93]">{event.actorName}</p>
      </div>
      <span className="shrink-0 text-[11px] font-medium text-[#697A93]">
        {formatRelativeTime(event.occurredAt)}
      </span>
    </button>
  );
}

export function SearchResultRow(props: SearchResultRowProps) {
  switch (props.variant) {
    case "cliente":
      return <ClienteRow {...props} />;
    case "prestamo":
      return <PrestamoRow {...props} />;
    case "evento":
      return <EventoRow {...props} />;
  }
}
