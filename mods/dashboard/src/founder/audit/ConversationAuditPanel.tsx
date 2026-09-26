/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Findings of one conversation-audit run in the right side panel (Pencil
 * EzobQ §09, `VA81L`): critical first, then warnings. Each finding shows the
 * rule, its source (AI judge or fixed check), who and which agent, the cited
 * message, why, and "Ver conversación" when it's tied to an application.
 */
import {
  ArrowUpRight,
  Check,
  ListChecks,
  MessageSquareWarning,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { trpc, type RouterOutputs } from "../../lib/trpc";
import { cn } from "../../lib/cn";
import { SidePanel } from "../components/SidePanel";
import { SectionLabel } from "../applications/ui";
import { agentDisplayName } from "../agentNames";
import { formatShortDateTime } from "../components/format";

export type AuditDetail = NonNullable<RouterOutputs["listConversationAuditFindings"]>;
type Finding = AuditDetail["findings"][number];

function speakerLabel(f: Finding): string {
  if (!f.turn) return "";
  if (f.turn.role === "INBOUND") return f.personLabel.split(" ")[0] ?? "Persona";
  if (f.turn.role === "SYSTEM") return "Mikro (automático)";
  return agentDisplayName(f.turn.agentName);
}

function FindingCard({
  finding: f,
  onOpenConversation
}: {
  finding: Finding;
  onOpenConversation?: (applicationId: string) => void;
}) {
  const critical = f.severity === "CRITICAL";
  const who = [
    f.personLabel,
    f.personLabel !== f.phone ? f.phone : null,
    f.agentName
      ? `${agentDisplayName(f.agentName)}${f.agentVersion ? ` v ${f.agentVersion.slice(0, 7)}` : ""}`
      : null
  ]
    .filter(Boolean)
    .join(" · ");
  const turnMeta = f.turn
    ? [
        speakerLabel(f),
        formatShortDateTime(f.turn.createdAt),
        f.turn.failed ? "NO ENTREGADO" : null
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-[12px] border border-[#E5EAF1] p-[14px]",
        critical ? "bg-[#FFF7F7]" : "bg-white"
      )}
      data-testid="audit-finding"
      data-severity={f.severity}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "shrink-0 rounded-[6px] px-[7px] py-[2px] text-[10px] font-bold",
            critical ? "bg-ds-red-bg text-ds-red" : "bg-ds-amber-bg text-ds-amber"
          )}
        >
          {critical ? "CRÍTICO" : "ADVERTENCIA"}
        </span>
        <span className="min-w-0 flex-1 text-[13px] font-semibold text-[#14254A]">{f.rule}</span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-[6px] bg-[#F4F7FB] px-[7px] py-[2px] text-[10px] font-semibold text-[#697A93]">
          {f.source === "JUDGE" ? <Sparkles size={11} /> : <ListChecks size={11} />}
          {f.source === "JUDGE" ? "Juez IA" : "Chequeo fijo"}
        </span>
      </div>
      <p className="text-[12px] font-medium text-[#697A93]">{who}</p>
      {f.evidence && (
        <div className="flex flex-col gap-[3px] rounded-[8px] bg-[#F4F7FB] px-3 py-2">
          {turnMeta && (
            <span className="text-[10px] font-semibold uppercase text-[#697A93]">{turnMeta}</span>
          )}
          <p className="text-[12px] italic leading-[1.4] text-[#14254A]">“{f.evidence}”</p>
        </div>
      )}
      <p className="text-[12px] font-medium leading-[1.4] text-[#14254A]">{f.reason}</p>
      {f.applicationId && onOpenConversation && (
        <button
          type="button"
          onClick={() => onOpenConversation(f.applicationId!)}
          className="inline-flex w-fit items-center gap-1 text-[12px] font-semibold text-[#1F4AA8] hover:text-[#14356e]"
          data-testid="audit-finding-open-conversation"
        >
          Ver conversación
          <ArrowUpRight size={13} />
        </button>
      )}
    </div>
  );
}

export interface AuditFindingsViewProps {
  detail: AuditDetail;
  onOpenConversation?: (applicationId: string) => void;
}

/** The panel body: status line, findings by severity, footer line. Pure, for stories. */
export function AuditFindingsView({ detail, onOpenConversation }: AuditFindingsViewProps) {
  const { run, findings } = detail;
  const critical = findings.filter((f) => f.severity === "CRITICAL");
  const warnings = findings.filter((f) => f.severity === "WARNING");
  const flaggedConversations = new Set(findings.map((f) => f.phone)).size;
  const clean = Math.max(0, run.conversations - flaggedConversations);

  return (
    <div className="flex flex-col gap-[22px]" data-testid="audit-findings">
      <div className="flex flex-wrap items-center gap-2">
        {run.criticalCount > 0 && (
          <span className="inline-flex items-center gap-[5px] rounded-full bg-ds-red-bg px-[9px] py-[3px] text-[11px] font-semibold text-ds-red">
            <span className="h-[6px] w-[6px] rounded-full bg-ds-red" />
            {run.criticalCount} crítico{run.criticalCount === 1 ? "" : "s"}
          </span>
        )}
        {run.warningCount > 0 && (
          <span className="inline-flex items-center gap-[5px] rounded-full bg-ds-amber-bg px-[9px] py-[3px] text-[11px] font-semibold text-ds-amber">
            <span className="h-[6px] w-[6px] rounded-full bg-ds-amber" />
            {run.warningCount} advertencia{run.warningCount === 1 ? "" : "s"}
          </span>
        )}
        <span className="text-[12px] font-medium text-[#697A93]">
          {run.conversations} conversaci{run.conversations === 1 ? "ón" : "ones"} · {run.handoffs}{" "}
          {run.handoffs === 1 ? "pasó" : "pasaron"} a persona · {run.failedSends} no entregado
          {run.failedSends === 1 ? "" : "s"}
        </span>
      </div>

      {critical.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionLabel>Crítico</SectionLabel>
          {critical.map((f) => (
            <FindingCard key={f.id} finding={f} onOpenConversation={onOpenConversation} />
          ))}
        </section>
      )}
      {warnings.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionLabel>Advertencias</SectionLabel>
          {warnings.map((f) => (
            <FindingCard key={f.id} finding={f} onOpenConversation={onOpenConversation} />
          ))}
        </section>
      )}

      <p className="flex items-center gap-2 text-[12px] font-medium text-[#697A93]">
        <Check size={14} className="text-ds-green" />
        {clean} conversaci{clean === 1 ? "ón" : "ones"} sin problemas · {run.judged} revisadas por
        el juez IA · {run.judgeErrors} errores del juez
      </p>
    </div>
  );
}

export interface ConversationAuditPanelProps {
  runId: string;
  onClose: () => void;
  onOpenConversation?: (applicationId: string) => void;
}

export function ConversationAuditPanel({
  runId,
  onClose,
  onOpenConversation
}: ConversationAuditPanelProps) {
  const query = trpc.listConversationAuditFindings.useQuery({ runId }, { retry: 1 });
  const detail = query.data;
  const problems = detail ? detail.run.criticalCount + detail.run.warningCount : 0;
  const subtitle = detail
    ? [
        formatShortDateTime(detail.run.startedAt),
        detail.run.trigger === "MANUAL" ? `pedida por ${detail.run.actorName}` : "automática",
        detail.run.windowStart
          ? `revisó desde ${formatShortDateTime(detail.run.windowStart)}`
          : null
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  return (
    <SidePanel
      open
      onClose={onClose}
      title="Auditoría de conversaciones"
      subtitle={subtitle}
      icon={detail && problems === 0 ? ShieldCheck : MessageSquareWarning}
      iconClassName={
        detail && problems === 0 ? "bg-ds-green-bg text-ds-green" : "bg-ds-amber-bg text-ds-amber"
      }
      testId="audit-panel"
    >
      {query.isPending && <p className="text-sm font-medium text-[#697A93]">Cargando…</p>}
      {query.isError && (
        <p className="text-sm font-medium text-ds-red" data-testid="audit-panel-error">
          No se pudo cargar el detalle de la auditoría. {query.error.message}
        </p>
      )}
      {query.isSuccess && !detail && (
        <p className="text-sm font-medium text-[#697A93]">Esta auditoría ya no existe.</p>
      )}
      {detail && <AuditFindingsView detail={detail} onOpenConversation={onOpenConversation} />}
    </SidePanel>
  );
}
