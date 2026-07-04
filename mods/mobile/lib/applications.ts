/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Mobile port of the shared display + transition helpers for loan
 * applications (solicitudes), mirroring `mods/dashboard/src/lib/applications.ts`.
 * Spanish copy matches the locked Pencil evaluator screens (flow board `gzBYk`).
 * Shared by every evaluator screen (queue/search/history/detail/edit/approve/
 * contract/convert — task groups 3-8).
 */
import { BUSINESS_TYPE_LABELS, PROVINCE_LABELS } from "@mikro/common/schemas";

export type ApplicationStatus =
  | "DRAFT"
  | "RECEIVED"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SIGNED"
  | "CONVERTED";

export type BadgeTone = "green" | "amber" | "red" | "neutral";

// Status renders as plain text (Pencil v2): neutral everywhere except "Nueva"
// (RECEIVED) and a couple of terminal states, matching the desktop convention.
export const STATUS_META: Record<ApplicationStatus, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: "Borrador", tone: "neutral" },
  RECEIVED: { label: "Nueva", tone: "green" },
  IN_REVIEW: { label: "En evaluación", tone: "neutral" },
  APPROVED: { label: "Aprobada", tone: "neutral" },
  REJECTED: { label: "Rechazada", tone: "neutral" },
  SIGNED: { label: "Firmada", tone: "green" },
  CONVERTED: { label: "Convertida", tone: "green" }
};

export function statusMeta(status: string): { label: string; tone: BadgeTone } {
  return STATUS_META[status as ApplicationStatus] ?? { label: status, tone: "neutral" };
}

export const RISK_BAND_META: Record<string, { label: string; tone: BadgeTone }> = {
  LOW_RISK: { label: "Riesgo bajo", tone: "neutral" },
  MODERATE_RISK: { label: "Riesgo moderado", tone: "neutral" },
  MEDIUM_HIGH_RISK: { label: "Riesgo medio-alto", tone: "neutral" },
  HIGH_RISK: { label: "Riesgo alto", tone: "neutral" },
  VERY_HIGH_RISK: { label: "Riesgo muy alto", tone: "neutral" },
  OUT_OF_COVERAGE: { label: "Fuera de zona", tone: "neutral" }
};

export function riskBandMeta(
  band: string | null | undefined
): { label: string; tone: BadgeTone } | null {
  if (!band) return null;
  return RISK_BAND_META[band] ?? { label: band, tone: "neutral" };
}

// Scoring engine recommendation codes -> human-readable Spanish labels.
export const RECOMMENDATION_META: Record<string, string> = {
  APPROVE: "Aprobar",
  APPROVE_WITH_CONDITIONS: "Aprobar con condiciones",
  MANUAL_REVIEW: "Revisión manual",
  LIKELY_REJECT: "Probable rechazo",
  REJECT: "Rechazar",
  REJECT_OUT_OF_ZONE: "Rechazar — fuera de zona",
  REJECT_CRITICAL_BUSINESS: "Rechazar — negocio no elegible"
};

export function recommendationLabel(value: string | null | undefined): string {
  if (!value) return "";
  return RECOMMENDATION_META[value] ?? value;
}

// Scoring confidence codes -> human-readable Spanish labels.
export const CONFIDENCE_META: Record<string, string> = {
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja"
};

export function confidenceLabel(value: string | null | undefined): string {
  if (!value) return "";
  return CONFIDENCE_META[value] ?? value;
}

/** Which review/pipeline actions are valid from a given status (mirrors the API). */
export function allowedActions(status: string): {
  canPromote: boolean;
  canClaim: boolean;
  canApprove: boolean;
  canReject: boolean;
  canReopen: boolean;
  canSign: boolean;
  canConvert: boolean;
} {
  return {
    canPromote: status === "DRAFT",
    canClaim: status === "RECEIVED",
    canApprove: status === "RECEIVED" || status === "IN_REVIEW",
    canReject: status === "RECEIVED" || status === "IN_REVIEW",
    canReopen: status === "APPROVED" || status === "REJECTED",
    canSign: status === "APPROVED",
    canConvert: status === "SIGNED"
  };
}

/**
 * Label for the "reopen" action, worded for the status it's reopening from.
 * Both APPROVED and REJECTED reopen to IN_REVIEW, but "Reabrir" only reads
 * right for a rejected/closed request — undoing an approval is really sending
 * it *back* into the evaluation queue, so it says "Regresar a evaluaciones".
 */
export function reopenActionLabel(status: string): string {
  return status === "APPROVED" ? "Regresar a evaluaciones" : "Reabrir solicitud";
}

export function formatDop(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return `RD$ ${n.toLocaleString("es-DO", { maximumFractionDigits: 0 })}`;
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

/** Detect a tRPC FORBIDDEN error (non-reviewer) for a friendly access message. */
export function isForbidden(err: unknown): boolean {
  const data = (err as { data?: { code?: string } } | null)?.data;
  return data?.code === "FORBIDDEN";
}

export function businessTypeLabel(value: string | null | undefined): string {
  if (!value) return "";
  return BUSINESS_TYPE_LABELS[value] ?? value;
}

export function provinceLabel(value: string | null | undefined): string {
  if (!value) return "";
  return PROVINCE_LABELS[value] ?? value;
}

export function applicantName(app: {
  firstName?: string | null;
  lastName?: string | null;
}): string {
  return [app.firstName, app.lastName].filter(Boolean).join(" ").trim();
}

// ---- list-row risk styling (Inicio/Cola/Buscar/Historial SolicitudRow pills) ----
//
// Mobile list rows color-code by risk band (Pencil), unlike the desktop's flat
// status-tone badges. SolicitudRow/ScoreSummary (built in task group 2) only
// support a 3-way low/medium/high variant, so bands collapse into that set.
export type RiskVariant = "low" | "medium" | "high";

export function riskVariantForBand(band: string | null | undefined): RiskVariant {
  switch (band) {
    case "LOW_RISK":
      return "low";
    case "MODERATE_RISK":
    case "MEDIUM_HIGH_RISK":
      return "medium";
    case "HIGH_RISK":
    case "VERY_HIGH_RISK":
    case "OUT_OF_COVERAGE":
      return "high";
    default:
      return "medium";
  }
}

/**
 * Short row-pill label for SolicitudRow list items — distinct, shorter wording
 * from RISK_BAND_META's labels (used on the detail score card), matching the
 * exact copy already verified against Pencil in the group 2 Storybook stories
 * ("Bajo riesgo" / "Riesgo medio" / "Riesgo alto"). Unscored applications show
 * "Nueva", except DRAFT rows (mikro/#72) which show "Borrador" — SolicitudRow
 * has no dedicated neutral/pending pill color, so both fall back to the
 * "medium" (amber) variant.
 */
export function riskRowLabel(
  band: string | null | undefined,
  score: number | null | undefined,
  status?: string | null
): string {
  if (status === "DRAFT") return "Borrador";
  if (score == null) return "Nueva";
  switch (riskVariantForBand(band)) {
    case "low":
      return "Bajo riesgo";
    case "high":
      return "Riesgo alto";
    default:
      return "Riesgo medio";
  }
}

export function riskRowVariant(
  band: string | null | undefined,
  score: number | null | undefined
): RiskVariant {
  if (score == null) return "medium";
  return riskVariantForBand(band);
}

/** Maps a STATUS_META tone to the SolicitudRow risk-pill color set (Historial rows). */
export function toneToRowVariant(tone: BadgeTone): RiskVariant {
  if (tone === "green") return "low";
  if (tone === "red") return "high";
  return "medium";
}

// ---- pipeline / SLA helpers (detail screen progress card, group 4) ----

export const PIPELINE_STEPS: Array<{ status: ApplicationStatus; label: string }> = [
  { status: "RECEIVED", label: "Nueva" },
  { status: "IN_REVIEW", label: "En evaluación" },
  { status: "APPROVED", label: "Aprobada" },
  { status: "SIGNED", label: "Firmada" },
  { status: "CONVERTED", label: "Convertida" }
];

export function nextHint(status: string): string | null {
  switch (status) {
    case "RECEIVED":
    case "IN_REVIEW":
      return "Aprobar → Firmar contrato";
    case "APPROVED":
      return "Subir contrato firmado";
    case "SIGNED":
      return "Convertir en cliente";
    default:
      return null;
  }
}

export const CATEGORY_LABELS: Record<string, string> = {
  PAYMENT_CAPACITY: "Capacidad de pago",
  BUSINESS_TYPE_RISK: "Riesgo del negocio",
  TRACK_RECORD_FORMALIZATION: "Trayectoria y formalización",
  ROOTEDNESS_STABILITY: "Arraigo y estabilidad",
  SUPPORT_NETWORK: "Red de soporte",
  LOAN_PURPOSE: "Propósito del préstamo"
};

/** Category breakdown bar accent color by score band (matches Pencil `Vtr3b`). */
export function categoryColor(score: number): string {
  if (score < 40) return "#DC2626";
  if (score < 60) return "#D97706";
  return "#1F4AA8";
}

// Applications older than this are flagged "urgente" on Inicio/Cola —
// approaching the 48h evaluation SLA (see proposal.md). There's no dedicated
// SLA-deadline field on the backend yet, so this is a client-side heuristic
// (48h SLA, flagged once 3/4 of the window has elapsed).
export const URGENT_THRESHOLD_HOURS = 36;

export function isUrgent(createdAt: string | Date): boolean {
  const elapsedMs = Date.now() - new Date(createdAt).getTime();
  return elapsedMs >= URGENT_THRESHOLD_HOURS * 60 * 60 * 1000;
}

/** Compact "time ago" — "6 min" / "3h" / "2 días" (matches Pencil row-meta copy). */
export function timeAgo(value: string | Date): string {
  const diffMs = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "un momento";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days} día${days === 1 ? "" : "s"}`;
}
