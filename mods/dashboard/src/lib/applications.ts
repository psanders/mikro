/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Display helpers for loan applications (solicitudes) in the founder app.
 * Which actions a person may take is NOT decided here: that is
 * `evaluateTransition` from @mikro/common, the same rules the server enforces.
 */
import {
  evaluateTransition,
  TRANSITION_BLOCK_LABELS,
  type ApplicationForTransition,
  type EvidenceStatus,
  type ReviewAction,
  type TransitionActor
} from "@mikro/common/schemas";

export type ApplicationStatus =
  | "DRAFT"
  | "RECEIVED"
  | "IN_REVIEW"
  | "PENDING_DECISION"
  | "APPROVED"
  | "CONVERTED"
  | "REJECTED"
  | "ABANDONED";

/**
 * One label per status. Color follows one rule across the app: violet while
 * the application is in progress, green/red only for the final outcome.
 */
export const STATUS_META: Record<ApplicationStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: "Borrador", tone: "muted" },
  RECEIVED: { label: "Recibida", tone: "violet" },
  IN_REVIEW: { label: "En evaluación", tone: "violet" },
  PENDING_DECISION: { label: "Esperando decisión", tone: "violet" },
  APPROVED: { label: "Aprobada", tone: "violet" },
  CONVERTED: { label: "Convertida", tone: "green" },
  REJECTED: { label: "Rechazada", tone: "red" },
  ABANDONED: { label: "Desistida", tone: "muted" }
};

export type StatusTone = "violet" | "green" | "red" | "muted";

export function statusMeta(status: string): { label: string; tone: StatusTone } {
  return STATUS_META[status as ApplicationStatus] ?? { label: status, tone: "muted" };
}

/** Closed applications leave the active feed for the day's "Cerradas" group. */
export const CLOSED_STATUSES: ReadonlySet<string> = new Set(["CONVERTED", "REJECTED", "ABANDONED"]);

export function isClosed(status: string | null | undefined): boolean {
  return Boolean(status && CLOSED_STATUSES.has(status));
}

/** Score chip color: the risk scale, independent of the status colors. */
export function scoreTone(score: number | null | undefined): "green" | "amber" | "red" | "muted" {
  if (score == null) return "muted";
  if (score >= 65) return "green";
  if (score >= 50) return "amber";
  return "red";
}

export interface ActionCheck {
  enabled: boolean;
  /** Spanish reason when disabled (from TRANSITION_BLOCK_LABELS). */
  reason?: string;
}

/**
 * Whether `actor` may start `action` now. Input-only requirements (a reason, a
 * note, terms) are ignored — those are asked for when the action opens.
 */
export function checkAction(
  app: ApplicationForTransition,
  action: ReviewAction,
  actor: TransitionActor,
  evidence?: EvidenceStatus
): ActionCheck {
  const r = evaluateTransition(app, action, actor, {}, { evidence }, { ignoreInput: true });
  return r.ok ? { enabled: true } : { enabled: false, reason: TRANSITION_BLOCK_LABELS[r.reason] };
}

/** The rule slice from a `getApplication` row (money columns may be Decimal strings). */
export function forTransition(app: {
  status: string;
  assignedReviewerId: string | null;
  reviewerRecommendation: string | null;
  contractFilename: string | null;
  approvedAmount: unknown;
  contractTerms?: unknown;
}): ApplicationForTransition {
  return {
    status: app.status as ApplicationForTransition["status"],
    assignedReviewerId: app.assignedReviewerId,
    reviewerRecommendation: app.reviewerRecommendation,
    contractFilename: app.contractFilename,
    approvedAmount: app.approvedAmount == null ? null : Number(app.approvedAmount),
    contractTerms: app.contractTerms ?? null
  };
}

export function applicantName(app: {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  businessName?: string | null;
}): string {
  const name = [app.firstName, app.lastName].filter(Boolean).join(" ").trim();
  return name || app.businessName?.trim() || `#${app.id.slice(0, 8)}`;
}

export const RISK_BAND_META: Record<string, string> = {
  LOW_RISK: "Riesgo bajo",
  MODERATE_RISK: "Riesgo moderado",
  MEDIUM_HIGH_RISK: "Riesgo medio-alto",
  HIGH_RISK: "Riesgo alto",
  VERY_HIGH_RISK: "Riesgo muy alto",
  OUT_OF_COVERAGE: "Fuera de zona"
};

export function riskBandLabel(band: string | null | undefined): string {
  return band ? (RISK_BAND_META[band] ?? band) : "";
}

export function formatDop(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return `RD$${n.toLocaleString("es-DO", { maximumFractionDigits: 0 })}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "short", year: "numeric" }).format(
        d
      );
}

/** Detect a tRPC FORBIDDEN error for a friendly access message. */
export function isForbidden(err: unknown): boolean {
  const data = (err as { data?: { code?: string } } | null)?.data;
  return data?.code === "FORBIDDEN";
}

/** The Spanish part of a server error message (drops the "[CODE: …]" debug tail). */
export function friendlyError(err: unknown, fallback: string): string {
  const msg = (err as { message?: string } | null)?.message;
  if (!msg) return fallback;
  return msg.replace(/\s*\[[A-Z_]+:.*\]$/, "").trim() || fallback;
}
