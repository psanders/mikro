/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared display + transition helpers for loan applications (solicitudes),
 * mirroring the backend lifecycle and review transition map.
 */
import type { BadgeTone } from "../components/ui/Badge";

export type ApplicationStatus =
  | "DRAFT"
  | "RECEIVED"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SIGNED"
  | "CONVERTED"
  | "ABANDONED";

// Status renders as plain text (Pencil v2): neutral everywhere except "Nueva"
// (RECEIVED) which is green to flag a new, actionable item in the inbox.
export const STATUS_META: Record<ApplicationStatus, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: "Borrador", tone: "neutral" },
  RECEIVED: { label: "Nueva", tone: "green" },
  IN_REVIEW: { label: "En evaluación", tone: "neutral" },
  APPROVED: { label: "Aprobada", tone: "neutral" },
  REJECTED: { label: "Rechazada", tone: "neutral" },
  SIGNED: { label: "Firmada", tone: "neutral" },
  CONVERTED: { label: "Convertida", tone: "neutral" },
  ABANDONED: { label: "Abandonada", tone: "neutral" }
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

export function riskBandMeta(band: string | null): { label: string; tone: BadgeTone } | null {
  if (!band) return null;
  return RISK_BAND_META[band] ?? { label: band, tone: "neutral" };
}

/** Status filter tabs for the list (Pencil Jnc0R), in display order. */
export const STATUS_TABS: Array<{ label: string; value: ApplicationStatus }> = [
  { label: "Nuevas", value: "RECEIVED" },
  { label: "En evaluación", value: "IN_REVIEW" },
  { label: "Aprobadas", value: "APPROVED" },
  { label: "Documentos", value: "SIGNED" },
  { label: "Convertidas", value: "CONVERTED" },
  { label: "Rechazadas", value: "REJECTED" }
];

/** Default filter when none is remembered. */
export const DEFAULT_STATUS: ApplicationStatus = "RECEIVED";

/** Which review/pipeline actions are valid from a given status (mirrors the API). */
export function allowedActions(status: string): {
  canClaim: boolean;
  canApprove: boolean;
  canReject: boolean;
  canReopen: boolean;
  canSign: boolean;
  canConvert: boolean;
} {
  return {
    canClaim: status === "RECEIVED",
    canApprove: status === "RECEIVED" || status === "IN_REVIEW",
    canReject: status === "RECEIVED" || status === "IN_REVIEW",
    canReopen: status === "APPROVED" || status === "REJECTED",
    canSign: status === "APPROVED",
    canConvert: status === "SIGNED"
  };
}

export function formatDop(value: unknown): string {
  const n = Number(value);
  return `RD$ ${Number.isFinite(n) ? n.toLocaleString("es-DO", { maximumFractionDigits: 0 }) : "—"}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "short", year: "numeric" }).format(
        d
      );
}

/** Detect a tRPC FORBIDDEN error (non-reviewer) for a friendly access message. */
export function isForbidden(err: unknown): boolean {
  const data = (err as { data?: { code?: string } } | null)?.data;
  return data?.code === "FORBIDDEN";
}
