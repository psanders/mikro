/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * "Conversación · WhatsApp" on the application panel (Pencil UbCzS,
 * sec-CONVERSACION): the applicant's persisted WhatsApp transcript (#299).
 * The person's messages sit left on white; everything Mikro sent sits right on
 * green — an agent's reply names the agent in violet, a fixed app reply says
 * so. Where a hand-off to a person began, a divider marks it: from there staff
 * reply in Chatwoot, which this thread does not include, so it links there.
 */
import { Image as ImageIcon, UserRound } from "lucide-react";
import { SectionLabel } from "./ui";

export interface ThreadTurn {
  id: number;
  role: "INBOUND" | "AGENT" | "SYSTEM";
  content: string;
  agentName: string | null;
  hasImage: boolean;
  createdAt: string | Date;
}

export interface ThreadHandoff {
  id: string;
  reason: string;
  openedAt: string | Date;
}

export interface ConversationThreadProps {
  turns: ThreadTurn[];
  handoffs: ThreadHandoff[];
  /** Label for the person's bubbles (the applicant's first name). */
  personName: string;
  chatwootUrl?: string | null;
  loading?: boolean;
  error?: boolean;
}

/** "20 sep 14:05", the design's timestamp. */
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function formatTurnTime(value: string | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${hh}:${mm}`;
}

/** "jose" → "José (agente)". Agent names come from agents.yaml. */
const AGENT_LABELS: Record<string, string> = {
  jose: "José",
  lucia: "Lucía",
  sofia: "Sofía",
  carmen: "Carmen"
};

function agentLabel(name: string | null): string {
  if (!name) return "Agente";
  return `${AGENT_LABELS[name] ?? name.charAt(0).toUpperCase() + name.slice(1)} (agente)`;
}

type Item =
  | { kind: "turn"; at: number; turn: ThreadTurn }
  | { kind: "handoff"; at: number; handoff: ThreadHandoff };

/** Turns and hand-off markers in time order (a marker sorts before a turn at the same instant). */
function timeline(turns: ThreadTurn[], handoffs: ThreadHandoff[]): Item[] {
  const items: Item[] = [
    ...handoffs.map((h) => ({
      kind: "handoff" as const,
      at: new Date(h.openedAt).getTime(),
      handoff: h
    })),
    ...turns.map((t) => ({ kind: "turn" as const, at: new Date(t.createdAt).getTime(), turn: t }))
  ];
  // Stable: turns keep their stored order among themselves.
  return items.sort((a, b) => a.at - b.at || (a.kind === b.kind ? 0 : a.kind === "turn" ? 1 : -1));
}

function Bubble({ turn, personName }: { turn: ThreadTurn; personName: string }) {
  const outbound = turn.role !== "INBOUND";
  const who =
    turn.role === "INBOUND"
      ? personName
      : turn.role === "AGENT"
        ? agentLabel(turn.agentName)
        : "Mikro (automático)";
  return (
    <div
      className={`flex w-full ${outbound ? "justify-end" : "justify-start"}`}
      data-testid="conversation-turn"
      data-role={turn.role}
    >
      <div
        className={`flex w-[360px] max-w-[85%] flex-col gap-[3px] rounded-[10px] px-[11px] py-[8px] ${
          outbound ? "bg-[#DCF3E4]" : "bg-white"
        }`}
      >
        <span
          className={`whitespace-nowrap text-[10.5px] font-semibold ${
            turn.role === "AGENT" ? "text-[#7C3AED]" : "text-[#697A93]"
          }`}
        >
          {who}
        </span>
        {turn.hasImage && (
          <span className="flex items-center gap-1 text-[11.5px] font-medium text-[#697A93]">
            <ImageIcon size={12} /> Foto
          </span>
        )}
        {turn.content && !(turn.hasImage && turn.content === "[Imagen]") && (
          <span className="whitespace-pre-wrap break-words text-[12.5px] font-medium leading-[18px] text-[#14254A]">
            {turn.content}
          </span>
        )}
        <span className="whitespace-nowrap text-[10px] font-medium text-[#697A93]">
          {formatTurnTime(turn.createdAt)}
        </span>
      </div>
    </div>
  );
}

function HandoffMarker({ handoff }: { handoff: ThreadHandoff }) {
  return (
    <div
      className="flex w-full items-center gap-2 py-1 text-[10.5px] font-semibold text-[#697A93]"
      data-testid="conversation-handoff"
    >
      <span className="h-px flex-1 bg-[#E5EAF1]" />
      <UserRound size={12} />
      <span className="text-center">
        Pasó a una persona · {handoff.reason} · {formatTurnTime(handoff.openedAt)}
      </span>
      <span className="h-px flex-1 bg-[#E5EAF1]" />
    </div>
  );
}

export function ConversationThread({
  turns,
  handoffs,
  personName,
  chatwootUrl,
  loading,
  error
}: ConversationThreadProps) {
  const items = timeline(turns, handoffs);
  return (
    <div className="flex flex-col gap-3" data-testid="application-conversation">
      <SectionLabel
        extra={
          chatwootUrl ? (
            <a
              href={chatwootUrl}
              target="_blank"
              rel="noreferrer"
              className="whitespace-nowrap text-[11px] font-semibold text-[#1F4AA8] hover:underline"
            >
              Abrir en Chatwoot →
            </a>
          ) : undefined
        }
      >
        Conversación · WhatsApp
      </SectionLabel>
      <div className="flex w-full flex-col gap-2 rounded-[12px] bg-[#F4F7FB] p-[14px]">
        {loading && <p className="text-[12px] text-[#697A93]">Cargando…</p>}
        {error && <p className="text-[12px] text-[#697A93]">No se pudo cargar la conversación.</p>}
        {!loading && !error && items.length === 0 && (
          <p className="text-[12.5px] font-medium text-[#697A93]">
            Todavía no hay mensajes de WhatsApp con este número.
          </p>
        )}
        {items.map((item) =>
          item.kind === "turn" ? (
            <Bubble key={`t-${item.turn.id}`} turn={item.turn} personName={personName} />
          ) : (
            <HandoffMarker key={`h-${item.handoff.id}`} handoff={item.handoff} />
          )
        )}
      </div>
    </div>
  );
}
