/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  HandCoins,
  Undo2,
  TriangleAlert,
  FileCheck,
  FileX,
  PenLine,
  BadgeCheck,
  Trash2,
  RotateCcw,
  Repeat,
  UserPlus,
  Sparkles,
  FileText,
  BellRing,
  AlarmClockCheck,
  CircleAlert,
  CalendarCheck,
  CalendarX,
  RefreshCw,
  MessageSquare,
  MessageSquareX
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { BusinessEventType, FeedEvent, NavigateTarget } from "./types";
import { formatAmount } from "./format";
import { METRIC_LABELS, formatThreshold } from "../copilot/ruleLabels";
import type { WatchRuleMetric } from "../copilot/types";

/** Metric-aware value formatting for `rule.alert` cards. */
function ruleMetricValue(metric: string, value: number): string {
  return metric in METRIC_LABELS
    ? formatThreshold(metric as WatchRuleMetric, value)
    : String(value);
}

export type FeedAccent = "green" | "amber" | "red" | "blue" | "neutral";

interface TypeVisual {
  icon: LucideIcon;
  accent: FeedAccent;
}

// Icon-circle tint (background stays ds.subtle, icon color per accent). Kept
// local to feed/ so `neutral` (loan.status_changed) doesn't need to be added
// to the shared IconChip tone set.
export const FEED_ICON_TONE: Record<FeedAccent, string> = {
  green: "text-ds-green",
  amber: "text-ds-amber",
  red: "text-ds-red",
  blue: "text-brand-blue-primary",
  neutral: "text-ds-muted"
};

// Accent-tinted icon-chip background, per the Pencil feed (green pill for
// payments, blue for the rest, red/amber for destructive/exception).
export const FEED_CHIP_BG: Record<FeedAccent, string> = {
  green: "bg-[#E8F7EE]",
  amber: "bg-[#FDF1E3]",
  red: "bg-[#FCEBEB]",
  blue: "bg-[#E9F2FF]",
  neutral: "bg-[#EEF3F9]"
};

/** Base icon + accent per event type (before per-instance overrides). */
const BASE_VISUALS: Record<BusinessEventType, TypeVisual> = {
  "payment.collected": { icon: HandCoins, accent: "green" },
  "payment.reversed": { icon: Undo2, accent: "amber" },
  "application.approved": { icon: FileCheck, accent: "green" },
  "application.rejected": { icon: FileX, accent: "red" },
  "application.signed": { icon: PenLine, accent: "blue" },
  "application.converted": { icon: BadgeCheck, accent: "blue" },
  "application.deleted": { icon: Trash2, accent: "red" },
  "application.restored": { icon: RotateCcw, accent: "green" },
  "loan.created": { icon: HandCoins, accent: "blue" },
  "loan.status_changed": { icon: Repeat, accent: "neutral" },
  "customer.created": { icon: UserPlus, accent: "blue" },
  "contract.generated": { icon: FileText, accent: "blue" },
  "copilot.action": { icon: Sparkles, accent: "blue" },
  "rule.alert": { icon: BellRing, accent: "amber" },
  "task.due": { icon: AlarmClockCheck, accent: "amber" },
  "task.needs_input": { icon: CircleAlert, accent: "amber" },
  "task.completed": { icon: CalendarCheck, accent: "green" },
  "task.failed": { icon: CalendarX, accent: "red" },
  "qcobro.synced": { icon: RefreshCw, accent: "blue" },
  // Base is amber ("enviado", awaiting a delivery receipt). `resolveVisual`
  // promotes it to green (delivered/read) or red (failed) from payload.status.
  "message.sent": { icon: MessageSquare, accent: "amber" }
};

/**
 * Delivery-state → card accent for a `message.sent` card. `accepted`/`sent` are
 * pending (amber); `delivered`/`read` succeeded (green); `failed` is red. The
 * live status is overlaid onto `payload.status` server-side by
 * `createListFeedEvents`, so this reflects real delivery on each refetch.
 */
function messageStatusAccent(status: unknown): FeedAccent {
  if (status === "delivered" || status === "read") return "green";
  if (status === "failed") return "red";
  return "amber";
}

/** `application.approved` with `payload.policyException === true`. */
export function isPolicyExceptionApproval(event: FeedEvent): boolean {
  return event.type === "application.approved" && event.payload.policyException === true;
}

export function isDeletion(event: FeedEvent): boolean {
  return event.type === "application.deleted";
}

/** Resolved icon + accent for one event, folding in the exception override. */
export function resolveVisual(event: FeedEvent): TypeVisual {
  if (isPolicyExceptionApproval(event)) {
    return { icon: TriangleAlert, accent: "amber" };
  }
  if (event.type === "message.sent") {
    const accent = messageStatusAccent(event.payload.status);
    return { icon: accent === "red" ? MessageSquareX : MessageSquare, accent };
  }
  return BASE_VISUALS[event.type];
}

/**
 * `application.deleted` and the policy-exception approval get a full card
 * tint (left border + tinted background); every other type only tints its
 * icon.
 */
export function resolveCardTint(event: FeedEvent): "amber" | "red" | null {
  if (isPolicyExceptionApproval(event)) return "amber";
  if (isDeletion(event)) return "red";
  // A WhatsApp send tints while pending (amber) or on failure (red); a delivered/
  // read message settles to a plain card.
  if (event.type === "message.sent") {
    const accent = messageStatusAccent(event.payload.status);
    if (accent === "red") return "red";
    if (accent === "amber") return "amber";
    return null;
  }
  return null;
}

/**
 * Event types worth fetching for the OS-notification trigger (issue #124):
 * every type whose BASE accent is red or amber, plus `application.approved`
 * — a policy-exception approval is promoted to amber by `resolveVisual`, so
 * the type has to be queried even though its base accent is green. Querying
 * this list still isn't the final word per-event: `resolveVisual(event)
 * .accent` settles it (rules out a plain, non-exception approval).
 */
export const ACCENT_ALERT_EVENT_TYPES: BusinessEventType[] = [
  ...(Object.keys(BASE_VISUALS) as BusinessEventType[]).filter((type) => {
    const accent = BASE_VISUALS[type].accent;
    return accent === "red" || accent === "amber";
  }),
  "application.approved"
];

export type CompactMetaTone = "muted" | "red";

export interface CompactMeta {
  text: string;
  tone: CompactMetaTone;
}

/**
 * The card's secondary (meta) line — a short, Spanish descriptor built from the
 * event's type + payload, matching the Pencil feed rows. Deletions render in
 * red; everything else muted.
 */
export function resolveCompactMeta(event: FeedEvent): CompactMeta {
  const { type, payload } = event;
  switch (type) {
    case "payment.collected": {
      const parts: string[] = [];
      const method = payload.method;
      parts.push(
        typeof method === "string"
          ? `Pago ${translate(PAYMENT_METHOD_LABELS, method).toLowerCase()}`
          : "Pago registrado"
      );
      if (typeof payload.lateFeeAmount === "number") parts.push("incluye recargo por mora");
      return { text: parts.join(" · "), tone: "muted" };
    }
    case "payment.reversed":
      return {
        text:
          typeof payload.reason === "string" && payload.reason ? payload.reason : "Pago revertido",
        tone: "muted"
      };
    case "application.approved":
      return {
        text:
          payload.policyException === true
            ? "Aprobada con excepción de política"
            : "Solicitud aprobada",
        tone: "muted"
      };
    case "application.rejected":
      return {
        text:
          typeof payload.note === "string" && payload.note ? payload.note : "Solicitud rechazada",
        tone: "muted"
      };
    case "application.signed":
      return { text: "Contrato firmado", tone: "muted" };
    case "application.converted": {
      const parts: string[] = [];
      if (typeof payload.loanNumber === "number") parts.push(`Préstamo #${payload.loanNumber}`);
      if (typeof payload.principal === "number") parts.push(formatAmount(payload.principal));
      parts.push("convertida en préstamo");
      return { text: parts.join(" · "), tone: "muted" };
    }
    case "application.deleted":
      return { text: "Restaurable por 30 días", tone: "red" };
    case "application.restored":
      return { text: "Solicitud restaurada", tone: "muted" };
    case "loan.status_changed": {
      const to =
        typeof payload.to === "string" && payload.to
          ? translate(LOAN_STATUS_LABELS, payload.to)
          : "";
      return { text: to ? `Estado actualizado: ${to}` : "Estado actualizado", tone: "muted" };
    }
    case "customer.created":
      return { text: "Nuevo cliente registrado", tone: "muted" };
    // The loan.created summary already spells out the amount, cuotas, and
    // frequency, so the meta line just labels the row (parallel to
    // customer.created) instead of repeating the cuota phrase.
    case "loan.created":
      return { text: "Nuevo préstamo", tone: "muted" };
    // Historical only (retired). Its summary names the amount but NOT the
    // cuotas, so the meta line adds them.
    case "contract.generated": {
      const installments = typeof payload.installments === "number" ? payload.installments : null;
      const adverb =
        typeof payload.frequency === "string" ? (FREQUENCY_ADVERBS[payload.frequency] ?? "") : "";
      if (installments === null) return { text: "", tone: "muted" };
      return {
        text: `${installments} cuota${installments === 1 ? "" : "s"}${adverb ? ` ${adverb}` : ""}`,
        tone: "muted"
      };
    }
    case "copilot.action": {
      const tool = typeof payload.toolName === "string" ? payload.toolName : "";
      return { text: tool ? `Copiloto · ${tool}` : "Copiloto", tone: "muted" };
    }
    case "rule.alert": {
      const name = typeof payload.ruleName === "string" ? payload.ruleName : "Regla";
      const metric = typeof payload.metric === "string" ? payload.metric : "";
      if (typeof payload.value === "number" && typeof payload.threshold === "number") {
        const value = ruleMetricValue(metric, payload.value);
        const threshold = ruleMetricValue(metric, payload.threshold);
        return { text: `${name} · valor ${value} vs umbral ${threshold}`, tone: "muted" };
      }
      return { text: name, tone: "muted" };
    }
    case "task.due":
      return { text: "Tarea programada · lista para confirmar", tone: "muted" };
    case "task.needs_input": {
      const missing = Array.isArray(payload.missingSlots)
        ? (payload.missingSlots as unknown[]).filter((s) => typeof s === "string").join(", ")
        : "";
      return {
        text: missing
          ? `Tarea programada · falta: ${missing}`
          : "Tarea programada · necesita información",
        tone: "muted"
      };
    }
    case "task.completed":
      return {
        text: payload.skipped === true ? "Tarea omitida" : "Tarea completada",
        tone: "muted"
      };
    case "task.failed":
      return {
        text:
          typeof payload.reason === "string" && payload.reason
            ? `Tarea fallida · ${payload.reason}`
            : "Tarea fallida",
        tone: "red"
      };
    case "qcobro.synced": {
      const customers = typeof payload.customers === "number" ? payload.customers : 0;
      const pushed = typeof payload.portfoliosPushed === "number" ? payload.portfoliosPushed : 0;
      const skipped = typeof payload.portfoliosSkipped === "number" ? payload.portfoliosSkipped : 0;
      const durationMs = typeof payload.durationMs === "number" ? payload.durationMs : 0;
      return {
        text: `${customers} clientes · ${pushed} portafolios enviados · ${skipped} omitidos · ${durationMs} ms`,
        tone: "muted"
      };
    }
    case "message.sent": {
      const status = typeof payload.status === "string" ? payload.status : "accepted";
      const label = MESSAGE_STATUS_LABELS[status] ?? "Enviado";
      if (status === "failed") {
        const reason = typeof payload.errorTitle === "string" ? payload.errorTitle : "";
        return { text: reason ? `${label} · ${reason}` : label, tone: "red" };
      }
      return { text: label, tone: "muted" };
    }
    default:
      return { text: "", tone: "muted" };
  }
}

/** Spanish delivery-state labels for a `message.sent` card's meta line. */
const MESSAGE_STATUS_LABELS: Record<string, string> = {
  accepted: "Enviado · esperando confirmación",
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  failed: "No entregado"
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta"
};

const PAYMENT_KIND_LABELS: Record<string, string> = {
  installment: "Cuota",
  late_fee: "Mora"
};

const LOAN_STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  completed: "Completado",
  cancelled: "Cancelado",
  defaulted: "En impago",
  pending: "Pendiente"
};

/** Plural adverb per payment frequency, for the contract narrative. */
const FREQUENCY_ADVERBS: Record<string, string> = {
  DAILY: "diarias",
  WEEKLY: "semanales",
  BIWEEKLY: "quincenales",
  MONTHLY: "mensuales"
};

const translate = (map: Record<string, string>, value: string) => map[value.toLowerCase()] ?? value;

/**
 * Narrative sentence for a deleted application, built from the deletion
 * snapshot (the row has dozens of technical columns; only what a founder
 * needs to recognize the deleted solicitud is used). No deletion reason is
 * included — `deleteApplicationSchema` doesn't capture one today.
 */
function deletionNarrative(event: FeedEvent): string | null {
  const snapshot = event.payload.snapshot;
  if (!snapshot || typeof snapshot !== "object") return null;
  const s = snapshot as Record<string, unknown>;
  const str = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : "");
  const num = (k: string) => (typeof s[k] === "number" ? (s[k] as number) : null);

  const name =
    `${str("firstName")} ${str("lastName")}`.trim() || event.customerName || "El cliente";
  const negocio = str("businessName") || str("businessType");
  const province = str("province");
  const amount = num("requestedAmount");
  const weeks = num("requestedTermWeeks");

  const ask = amount !== null ? ` ${formatAmount(amount)}` : "";
  const term = weeks !== null ? ` a ${weeks} semanas` : "";
  const negocioClause = negocio ? ` para ${negocio}` : "";
  const provinceClause = province ? ` en ${province}` : "";

  return `${name} solicitó${ask}${term}${negocioClause}${provinceClause}; ${event.actorName} la eliminó.`;
}

/**
 * Per-type narrative sentence for the expanded card, template-composed from
 * fields already on the event — no LLM call, no network request. Returns
 * `null` when the compact `summary` line already says everything there is
 * to say for that type, so the card doesn't repeat itself.
 */
export function resolveNarrative(event: FeedEvent): string | null {
  const { type, payload, actorName, customerName } = event;

  switch (type) {
    case "payment.collected": {
      const method =
        typeof payload.method === "string"
          ? translate(PAYMENT_METHOD_LABELS, payload.method).toLowerCase()
          : "";
      const kind =
        typeof payload.kind === "string"
          ? translate(PAYMENT_KIND_LABELS, payload.kind).toLowerCase()
          : "";
      const lateFee = typeof payload.lateFeeAmount === "number" ? payload.lateFeeAmount : null;
      const sentence = `Pago${method ? ` ${method}` : ""} registrado${kind ? ` como ${kind}` : ""}.`;
      return lateFee !== null
        ? `${sentence} Incluye recargo por mora de ${formatAmount(lateFee)}.`
        : sentence;
    }
    case "payment.reversed": {
      const reason = typeof payload.reason === "string" && payload.reason ? payload.reason : "";
      const who = customerName ? ` de ${customerName}` : "";
      return `${actorName} revirtió el pago${who}.${reason ? ` Motivo: ${reason}.` : ""}`;
    }
    case "application.approved": {
      const exception = payload.policyException === true;
      const note = typeof payload.note === "string" && payload.note ? payload.note : "";
      return `Solicitud de ${customerName ?? "cliente"} aprobada por ${actorName}${exception ? ", con excepción de política" : ""}.${note ? ` Nota: ${note}.` : ""}`;
    }
    case "application.rejected": {
      const note = typeof payload.note === "string" && payload.note ? payload.note : "";
      return `Solicitud de ${customerName ?? "cliente"} rechazada por ${actorName}.${note ? ` Motivo: ${note}.` : ""}`;
    }
    case "application.signed":
      return null;
    case "application.converted": {
      const loanNumber = typeof payload.loanNumber === "number" ? payload.loanNumber : null;
      const principal = typeof payload.principal === "number" ? payload.principal : null;
      return `Solicitud de ${customerName ?? "cliente"} convertida${loanNumber !== null ? ` en el préstamo #${loanNumber}` : ""}${principal !== null ? ` por ${formatAmount(principal)}` : ""}.`;
    }
    case "application.deleted":
      return deletionNarrative(event);
    case "application.restored":
      return null;
    case "loan.status_changed": {
      const to =
        typeof payload.to === "string" && payload.to
          ? translate(LOAN_STATUS_LABELS, payload.to)
          : "";
      if (!to) return null;
      const from =
        typeof payload.from === "string" && payload.from
          ? translate(LOAN_STATUS_LABELS, payload.from)
          : "";
      return `Préstamo actualizado${from ? ` de ${from}` : ""} a ${to}.`;
    }
    case "customer.created":
      return null;
    // Both cards' summary line already names the actor, customer, and amount;
    // the compact meta line (resolveCompactMeta) already adds cuotas/frequency.
    // No narrative needed — one used to restate the summary in different
    // wording, which read as duplicated text when expanded.
    case "loan.created":
    case "contract.generated":
      return null;
    case "copilot.action": {
      const resultSummary =
        typeof payload.resultSummary === "string" && payload.resultSummary
          ? payload.resultSummary
          : "";
      if (resultSummary) return resultSummary;
      const toolName = typeof payload.toolName === "string" ? payload.toolName : "";
      return toolName ? `Herramienta ejecutada: ${toolName}.` : null;
    }
    case "rule.alert":
      return null;
    case "task.due":
    case "task.needs_input":
      // The live action widget (TaskActionCard) carries the substance while
      // the firing is open; a resolved firing's compact line says the rest.
      return null;
    case "task.completed": {
      const resultSummary =
        typeof payload.resultSummary === "string" && payload.resultSummary
          ? payload.resultSummary
          : "";
      return resultSummary || null;
    }
    case "task.failed":
      return null;
    case "qcobro.synced":
      return null;
    case "message.sent":
      // The compact meta line already carries the delivery state.
      return null;
  }
}

interface SubjectLink {
  label: string;
  target: NavigateTarget;
}

/**
 * The numeric loan number (`Loan.loanId`) for an event, if resolvable — the
 * id every copilot loan tool actually takes (never the `Loan.id` UUID on
 * `event.loanId`). Sourced from the read-time `loanNumber` enrichment
 * (`enrichLoanNumbers` on the apiserver); `application.converted` also has it
 * denormalized onto its own payload.
 */
function resolveLoanNumber(event: FeedEvent): number | null {
  if (typeof event.loanNumber === "number") return event.loanNumber;
  if (event.type === "application.converted" && typeof event.payload.loanNumber === "number") {
    return event.payload.loanNumber;
  }
  return null;
}

/** The "Ver X" link for the event's subject — null once the subject is gone (deletions). */
export function resolveSubjectLink(event: FeedEvent): SubjectLink | null {
  switch (event.type) {
    case "payment.collected":
    case "payment.reversed":
    case "loan.created":
    case "loan.status_changed":
    case "application.converted": {
      // A UUID prefill is worse than no link: the copilot's loan tools only
      // accept the numeric loanId, so without a resolved number there's
      // nothing useful to link to.
      const loanNumber = resolveLoanNumber(event);
      return loanNumber !== null
        ? { label: "Ver préstamo", target: { kind: "loan", id: String(loanNumber) } }
        : null;
    }
    case "application.approved":
    case "application.rejected":
    case "application.signed":
    case "application.restored":
      return event.applicationId
        ? { label: "Ver solicitud", target: { kind: "application", id: event.applicationId } }
        : null;
    case "customer.created":
    case "contract.generated": {
      const customerId = event.payload.customerId;
      return typeof customerId === "string"
        ? { label: "Ver cliente", target: { kind: "customer", id: customerId } }
        : null;
    }
    case "application.deleted":
      return null;
    default:
      return null;
  }
}

/**
 * Spanish copilot question for a subject-link target. Feed/search "Ver
 * solicitud/préstamo/cliente" actions open the copilot dock prefilled with
 * this instead of navigating to a retired ops detail page.
 */
export function subjectQuestion(target: NavigateTarget, customerName?: string): string {
  switch (target.kind) {
    case "application":
      return `Muéstrame los detalles de la solicitud ${target.id}`;
    case "loan":
      return `Muéstrame los detalles del préstamo ${target.id}`;
    case "customer":
      return `Muéstrame al cliente ${customerName ?? target.id}`;
  }
}

/**
 * Spanish question prefilled into the copilot dock by a card's "IA insights"
 * link — deeper, record-specific synthesis, distinct from the (deletion-only)
 * ask-copilot chip's broader weekly question. Reuses `subjectQuestion` for
 * every type that already resolves a subject link; type-specific fallbacks
 * otherwise (deletions, loan status changes, copilot actions, rule alerts).
 */
export function resolveInsightsQuestion(event: FeedEvent): string {
  const subject = resolveSubjectLink(event);
  if (subject) return subjectQuestion(subject.target, event.customerName);

  switch (event.type) {
    case "payment.collected":
    case "payment.reversed":
      return `Cuéntame más sobre este pago${event.customerName ? ` de ${event.customerName}` : ""}.`;
    case "application.deleted":
      return `Cuéntame más sobre la solicitud eliminada${event.customerName ? ` de ${event.customerName}` : ""}.`;
    case "loan.status_changed":
      return "Cuéntame más sobre este cambio de estado del préstamo.";
    case "copilot.action":
      return "Cuéntame más sobre esta acción del copiloto.";
    case "rule.alert": {
      const ruleName = typeof event.payload.ruleName === "string" ? event.payload.ruleName : "";
      return ruleName
        ? `Cuéntame más sobre esta alerta: ${ruleName}.`
        : "Cuéntame más sobre esta alerta.";
    }
    case "task.due":
    case "task.needs_input":
    case "task.completed":
    case "task.failed": {
      const taskName = typeof event.payload.taskName === "string" ? event.payload.taskName : "";
      return taskName
        ? `Cuéntame más sobre la tarea "${taskName}".`
        : "Cuéntame más sobre esta tarea programada.";
    }
    case "qcobro.synced":
      return "Cuéntame más sobre esta sincronización con QCobro.";
    default:
      return "Cuéntame más sobre este evento.";
  }
}
