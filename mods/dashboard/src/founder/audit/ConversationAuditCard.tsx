/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The `conversation.audited` feed card (Pencil EzobQ §09, `ZfXZu`): the plain
 * FeedCard head plus a counts strip, the per-agent breakdown with each agent's
 * version, a preview of the worst finding, and "Ver detalle" → the findings
 * side panel. Renders from the event payload; only the panel fetches.
 */
import { useState } from "react";
import { ArrowUpRight, ListChecks, Sparkles } from "lucide-react";
import type { ConversationAuditedPayload } from "@mikro/common";
import { cn } from "../../lib/cn";
import { FeedCard, type FeedCardProps } from "../components/FeedCard";
import { agentDisplayName } from "../agentNames";
import { formatShortDateTime } from "../components/format";
import { ConversationAuditPanel } from "./ConversationAuditPanel";

/** Plain-language audience per profile, as the Pencil card lists them. */
const PROFILE_AUDIENCE: Record<string, string> = {
  GUEST: "visitantes",
  PROSPECT: "formulario",
  APPLICANT: "solicitantes",
  CUSTOMER: "clientes"
};

/** The payload, tolerant of older/partial rows (the event log is long-lived). */
export function readAuditPayload(payload: Record<string, unknown>): ConversationAuditedPayload {
  const p = payload as Partial<ConversationAuditedPayload>;
  const n = (v: unknown) => (typeof v === "number" ? v : 0);
  return {
    runId: typeof p.runId === "string" ? p.runId : "",
    trigger: p.trigger === "MANUAL" ? "MANUAL" : "SCHEDULED",
    conversations: n(p.conversations),
    turns: n(p.turns),
    handoffs: n(p.handoffs),
    failedSends: n(p.failedSends),
    criticalCount: n(p.criticalCount),
    warningCount: n(p.warningCount),
    judged: n(p.judged),
    judgeSkipped: n(p.judgeSkipped),
    judgeErrors: n(p.judgeErrors),
    windowStart: typeof p.windowStart === "string" ? p.windowStart : null,
    byAgent: Array.isArray(p.byAgent) ? p.byAgent : [],
    topFinding: p.topFinding ?? null
  };
}

function issuePill(critical: number, warning: number) {
  if (critical > 0)
    return {
      text: `${critical} crítico${critical === 1 ? "" : "s"}`,
      className: "bg-ds-red-bg text-ds-red"
    };
  if (warning > 0)
    return {
      text: `${warning} advertencia${warning === 1 ? "" : "s"}`,
      className: "bg-ds-amber-bg text-ds-amber"
    };
  return { text: "sin problemas", className: "bg-ds-green-bg text-ds-green" };
}

export interface AuditCardDetailProps {
  payload: ConversationAuditedPayload;
  onOpenConversation?: (applicationId: string) => void;
}

/** Counts strip + per-agent rows + worst-finding preview. */
export function AuditCardDetail({ payload, onOpenConversation }: AuditCardDetailProps) {
  const problems = payload.criticalCount + payload.warningCount;
  const stats: Array<[number, string, boolean]> = [
    [payload.conversations, "conversaciones", false],
    [payload.turns, "mensajes", false],
    [payload.handoffs, "pasaron a persona", false],
    [payload.failedSends, "no entregado", false],
    [problems, "problemas", problems > 0]
  ];
  const top = payload.topFinding;
  const more = problems - (top ? 1 : 0);

  return (
    <div className="flex flex-col gap-[14px]" data-testid="audit-card-detail">
      <div className="flex w-fit overflow-hidden rounded-[10px] border border-[#E5EAF1] bg-white">
        {stats.map(([value, label, warn], i) => (
          <div
            key={label}
            className={cn(
              "flex flex-col gap-[2px] px-[18px] py-[10px]",
              i < stats.length - 1 && "border-r border-[#E5EAF1]"
            )}
          >
            <span
              className={cn("text-[18px] font-bold", warn ? "text-ds-amber" : "text-[#14254A]")}
              data-testid={`audit-stat-${label.replace(/\s/g, "-")}`}
            >
              {value}
            </span>
            <span className="text-[11px] font-medium text-[#697A93]">{label}</span>
          </div>
        ))}
      </div>

      {payload.byAgent.length > 0 && (
        <div className="flex w-[560px] max-w-full flex-col gap-[6px]">
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#697A93]">
            Por agente
          </span>
          {payload.byAgent.map((a) => {
            const pill = issuePill(a.critical, a.warning);
            return (
              <div
                key={a.agentName}
                className="flex items-center gap-[10px]"
                data-testid="audit-agent-row"
              >
                <span className="w-16 text-[13px] font-semibold text-[#14254A]">
                  {agentDisplayName(a.agentName)}
                </span>
                <span className="w-[84px] text-[12px] font-medium text-[#697A93]">
                  {(a.profile && PROFILE_AUDIENCE[a.profile]) ?? ""}
                </span>
                <span
                  className={cn(
                    "w-[150px] font-mono text-[11px]",
                    a.isNewVersion ? "text-[#7C3AED]" : "text-[#697A93]"
                  )}
                >
                  {a.agentVersion ? `v ${a.agentVersion.slice(0, 7)}` : ""}
                  {a.isNewVersion ? " · nueva" : ""}
                </span>
                <span className="w-16 text-[12px] font-medium text-[#697A93]">
                  {a.conversations} conv.
                </span>
                <span
                  className={cn(
                    "rounded-full px-[9px] py-[3px] text-[11px] font-semibold",
                    pill.className
                  )}
                >
                  {pill.text}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {top && (
        <div
          className="flex w-[760px] max-w-full flex-col gap-[6px] rounded-[10px] border border-[#E5EAF1] bg-white px-[14px] py-[10px]"
          data-testid="audit-top-finding"
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-[6px] px-[7px] py-[2px] text-[10px] font-bold",
                top.severity === "CRITICAL"
                  ? "bg-ds-red-bg text-ds-red"
                  : "bg-ds-amber-bg text-ds-amber"
              )}
            >
              {top.severity === "CRITICAL" ? "CRÍTICO" : "ADVERTENCIA"}
            </span>
            <span className="truncate text-[12px] font-semibold text-[#14254A]">
              {top.agentName ? `${agentDisplayName(top.agentName)} · ` : ""}
              {top.rule}
            </span>
            <span className="truncate text-[12px] font-medium text-[#697A93]">
              {top.personLabel}
              {top.turnAt ? ` · ${formatShortDateTime(top.turnAt)}` : ""}
            </span>
            <span className="flex-1" />
            {top.applicationId && onOpenConversation && (
              <button
                type="button"
                onClick={() => onOpenConversation(top.applicationId!)}
                className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[#1F4AA8] hover:text-[#14356e]"
              >
                Ver conversación
                <ArrowUpRight size={13} />
              </button>
            )}
          </div>
          {top.quote && <p className="text-[12px] italic text-[#14254A]">“{top.quote}”</p>}
          {more > 0 && (
            <p className="text-[11px] font-medium text-[#697A93]">
              + {more} problema{more === 1 ? "" : "s"} más en el detalle
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** "¿Qué cambió en Sofía?" for the agent with the most issues, else a general question. */
export function auditAskQuestion(payload: ConversationAuditedPayload): string {
  const worst = payload.byAgent.find((a) => a.critical + a.warning > 0);
  return worst
    ? `¿Qué cambió en ${agentDisplayName(worst.agentName)}?`
    : "¿Cómo van las conversaciones de los agentes?";
}

export type ConversationAuditFeedCardProps = Omit<FeedCardProps, "detailSlot" | "actionSlot"> & {
  onOpenConversation?: (applicationId: string) => void;
};

export function ConversationAuditFeedCard(props: ConversationAuditFeedCardProps) {
  const { event, onAskCopilot, onOpenConversation, ...rest } = props;
  const [panelOpen, setPanelOpen] = useState(false);
  const payload = readAuditPayload(event.payload);
  const question = auditAskQuestion(payload);

  return (
    <div data-testid="audit-card">
      <FeedCard
        {...rest}
        event={event}
        onAskCopilot={onAskCopilot}
        className={cn(rest.className)}
        detailSlot={<AuditCardDetail payload={payload} onOpenConversation={onOpenConversation} />}
        actionSlot={
          <div className="flex flex-wrap items-center gap-[10px]">
            {payload.runId && (
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                data-testid="audit-open-detail"
                className="inline-flex items-center gap-[7px] rounded-[9px] bg-[#1F4AA8] px-4 py-[9px] text-[14px] font-medium text-white transition hover:bg-[#1A3F8F]"
              >
                <ListChecks size={15} />
                Ver detalle
              </button>
            )}
            {onAskCopilot && (
              <button
                type="button"
                onClick={() => onAskCopilot(question)}
                className="inline-flex items-center gap-[7px] rounded-full bg-[#E9F2FF] px-[14px] py-2 text-[12px] font-semibold text-[#1F4AA8] transition hover:bg-[#dbe8fb]"
              >
                <Sparkles size={13} />
                {question}
              </button>
            )}
          </div>
        }
      />
      {panelOpen && (
        <ConversationAuditPanel
          runId={payload.runId}
          onClose={() => setPanelOpen(false)}
          onOpenConversation={(applicationId) => {
            setPanelOpen(false);
            onOpenConversation?.(applicationId);
          }}
        />
      )}
    </div>
  );
}
