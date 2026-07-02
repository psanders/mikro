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
  UserPlus
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { BusinessEventType, FeedEvent, NavigateTarget } from "./types";
import { formatAmount, humanizeKey, humanizeValue } from "./format";

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
  "loan.status_changed": { icon: Repeat, accent: "neutral" },
  "customer.created": { icon: UserPlus, accent: "blue" }
};

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
  return null;
}

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
    default:
      return { text: "", tone: "muted" };
  }
}

interface DetailRow {
  label: string;
  value: string;
}

/** Payload keys already surfaced by a dedicated field/label — skip in the generic fallback. */
const HANDLED_KEYS: Record<BusinessEventType, string[]> = {
  "payment.collected": ["paymentId", "method", "kind", "lateFeeAmount"],
  "payment.reversed": ["paymentId", "reason"],
  "application.approved": ["applicationId", "policyException", "note"],
  "application.rejected": ["applicationId", "note"],
  "application.signed": ["applicationId"],
  "application.converted": ["applicationId", "loanId", "loanNumber", "principal"],
  "application.deleted": ["applicationId", "snapshot"],
  "application.restored": ["applicationId", "deletionEventId"],
  "loan.status_changed": ["loanId", "from", "to"],
  "customer.created": ["customerId"]
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

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  submitted: "Enviada",
  in_review: "En revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
  signed: "Firmada",
  converted: "Convertida",
  pending: "Pendiente"
};

const LOAN_STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  completed: "Completado",
  cancelled: "Cancelado",
  defaulted: "En impago",
  pending: "Pendiente"
};

const translate = (map: Record<string, string>, value: string) => map[value.toLowerCase()] ?? value;

/**
 * Curated Spanish rows from an application.deleted snapshot — the raw row has
 * dozens of technical columns (ids, session, raw JSON); the card shows only
 * what a founder needs to recognize the deleted solicitud.
 */
function snapshotDetailRows(snapshot: Record<string, unknown>): DetailRow[] {
  const str = (k: string) => (typeof snapshot[k] === "string" ? (snapshot[k] as string) : "");
  const num = (k: string) => (typeof snapshot[k] === "number" ? (snapshot[k] as number) : null);
  const rows: DetailRow[] = [];
  const name = `${str("firstName")} ${str("lastName")}`.trim();
  if (name) rows.push({ label: "Cliente", value: name });
  const negocio = str("businessName") || str("businessType");
  if (negocio) rows.push({ label: "Negocio", value: negocio });
  const monto = num("requestedAmount");
  if (monto !== null) rows.push({ label: "Monto solicitado", value: formatAmount(monto) });
  const plazo = num("requestedTermWeeks");
  if (plazo !== null) rows.push({ label: "Plazo", value: `${plazo} semanas` });
  if (str("province")) rows.push({ label: "Provincia", value: str("province") });
  if (str("status")) {
    rows.push({ label: "Estado", value: translate(APPLICATION_STATUS_LABELS, str("status")) });
  }
  return rows;
}

/** Key-value detail rows for the expanded card, per event type + generic fallback. */
export function resolveDetailRows(event: FeedEvent): DetailRow[] {
  const { type, payload } = event;
  const rows: DetailRow[] = [];

  switch (type) {
    case "payment.collected": {
      const method = payload.method;
      const kind = payload.kind;
      if (typeof method === "string") {
        rows.push({ label: "Método", value: translate(PAYMENT_METHOD_LABELS, method) });
      }
      if (typeof kind === "string") {
        rows.push({ label: "Tipo", value: translate(PAYMENT_KIND_LABELS, kind) });
      }
      if (typeof payload.lateFeeAmount === "number") {
        rows.push({ label: "Recargo por mora", value: formatAmount(payload.lateFeeAmount) });
      }
      break;
    }
    case "payment.reversed": {
      if (typeof payload.reason === "string" && payload.reason) {
        rows.push({ label: "Motivo", value: payload.reason });
      }
      break;
    }
    case "application.approved": {
      if (payload.policyException === true) {
        rows.push({ label: "Excepción de política", value: "Sí" });
      }
      if (typeof payload.note === "string" && payload.note) {
        rows.push({ label: "Nota", value: payload.note });
      }
      break;
    }
    case "application.rejected": {
      if (typeof payload.note === "string" && payload.note) {
        rows.push({ label: "Nota", value: payload.note });
      }
      break;
    }
    case "application.converted": {
      if (typeof payload.loanNumber === "number") {
        rows.push({ label: "Préstamo", value: `#${payload.loanNumber}` });
      }
      if (typeof payload.principal === "number") {
        rows.push({ label: "Principal", value: formatAmount(payload.principal) });
      }
      break;
    }
    case "application.deleted": {
      const snapshot = payload.snapshot;
      if (snapshot && typeof snapshot === "object") {
        rows.push(...snapshotDetailRows(snapshot as Record<string, unknown>));
      }
      break;
    }
    case "loan.status_changed": {
      if (typeof payload.to === "string") {
        const to = translate(LOAN_STATUS_LABELS, payload.to);
        const from =
          typeof payload.from === "string" && payload.from
            ? translate(LOAN_STATUS_LABELS, payload.from)
            : "";
        rows.push({ label: "Estado", value: from ? `${from} → ${to}` : to });
      }
      break;
    }
    case "application.signed":
    case "application.restored":
    case "customer.created":
      break;
  }

  // Generic fallback for anything the per-type mapping above didn't consume —
  // keeps future/unknown payload fields visible instead of silently dropped.
  const handled = new Set(HANDLED_KEYS[type]);
  for (const [key, value] of Object.entries(payload)) {
    if (handled.has(key)) continue;
    if (value === null || value === undefined || typeof value === "object") continue;
    rows.push({ label: humanizeKey(key), value: humanizeValue(value) });
  }

  return rows;
}

interface SubjectLink {
  label: string;
  target: NavigateTarget;
}

/** The "Ver X" link for the event's subject — null once the subject is gone (deletions). */
export function resolveSubjectLink(event: FeedEvent): SubjectLink | null {
  switch (event.type) {
    case "payment.collected":
    case "payment.reversed":
    case "loan.status_changed":
      return event.loanId
        ? { label: "Ver préstamo", target: { kind: "loan", id: event.loanId } }
        : null;
    case "application.approved":
    case "application.rejected":
    case "application.signed":
    case "application.restored":
      return event.applicationId
        ? { label: "Ver solicitud", target: { kind: "application", id: event.applicationId } }
        : null;
    case "application.converted":
      return event.loanId
        ? { label: "Ver préstamo", target: { kind: "loan", id: event.loanId } }
        : null;
    case "customer.created": {
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
