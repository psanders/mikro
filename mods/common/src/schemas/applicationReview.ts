/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The loan-application review lifecycle as one guarded transition table.
 *
 *   DRAFT → RECEIVED → IN_REVIEW → PENDING_DECISION → APPROVED → CONVERTED
 *                          ↑______________|  (returnToReviewer)
 *   exits: REJECTED (from IN_REVIEW or PENDING_DECISION), ABANDONED (withdraw from APPROVED)
 *
 * `evaluateTransition` is pure: the server calls it to authorize every review
 * mutation, and the founder app calls it to decide which actions are enabled and
 * to explain the disabled ones. Keeping both on the same function is the point —
 * there is no second copy of these rules anywhere.
 */
import { z } from "zod/v4";
import type { applicationStatusEnum } from "./application.js";
import type { roleEnum } from "./user.js";

type Status = z.infer<typeof applicationStatusEnum>;
type Role = z.infer<typeof roleEnum>;

export const REVIEW_ACTIONS = [
  "promote",
  "assign",
  "sendToDecision",
  "returnToReviewer",
  "approve",
  "reject",
  "withdraw",
  "convert"
] as const;

export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

/** Why an application was rejected. `OUT_OF_COVERAGE_AREA` is also set by intake. */
export const rejectionReasonEnum = z.enum([
  "OUT_OF_COVERAGE_AREA",
  "PAYMENT_CAPACITY",
  "DOCUMENTS",
  "OTHER"
]);
export type RejectionReason = z.infer<typeof rejectionReasonEnum>;

export const REJECTION_REASON_LABELS: Record<RejectionReason, string> = {
  OUT_OF_COVERAGE_AREA: "Fuera de zona",
  PAYMENT_CAPACITY: "Capacidad de pago",
  DOCUMENTS: "Documentos",
  OTHER: "Otro"
};

/** Why a transition is not allowed right now. */
export type TransitionBlock =
  | "NOT_ALLOWED" // caller's roles can never do this action
  | "WRONG_STATUS" // the application is not in a source status of the action
  | "NOT_ASSIGNEE" // only the assigned reviewer may do this
  | "ASSIGNEE_NOT_REVIEWER" // the target of an assignment lacks REVIEWER/ADMIN
  | "EVIDENCE_INCOMPLETE"
  | "RECOMMENDATION_REQUIRED"
  | "CONTRACT_REQUIRED"
  | "AMOUNT_MISMATCH" // conversion principal differs from the approved amount
  | "NOTE_REQUIRED"
  | "REASON_REQUIRED"
  | "TERMS_REQUIRED";

export const TRANSITION_BLOCK_LABELS: Record<TransitionBlock, string> = {
  NOT_ALLOWED: "Tu rol no permite esta acción",
  WRONG_STATUS: "No aplica en el estado actual",
  NOT_ASSIGNEE: "Solo el evaluador asignado puede hacerlo",
  ASSIGNEE_NOT_REVIEWER: "La persona elegida no es evaluadora",
  EVIDENCE_INCOMPLETE: "Falta evidencia",
  RECOMMENDATION_REQUIRED: "Falta la recomendación",
  CONTRACT_REQUIRED: "Falta el contrato firmado",
  AMOUNT_MISMATCH: "El monto no coincide con el aprobado",
  NOTE_REQUIRED: "Escribe una nota",
  REASON_REQUIRED: "Elige un motivo",
  TERMS_REQUIRED: "Indica monto y plazo aprobados"
};

/**
 * Blocks caused only by what the caller typed (or has yet to type). The UI
 * ignores these when deciding whether to enable a button — "Rechazar…" is
 * clickable before a reason is chosen — and enforces them on submit.
 */
const INPUT_BLOCKS: ReadonlySet<TransitionBlock> = new Set<TransitionBlock>([
  "NOTE_REQUIRED",
  "REASON_REQUIRED",
  "TERMS_REQUIRED",
  "AMOUNT_MISMATCH"
]);

/** How the server should report a block over tRPC. */
export function transitionBlockCode(
  block: TransitionBlock
): "FORBIDDEN" | "CONFLICT" | "BAD_REQUEST" {
  if (block === "NOT_ALLOWED" || block === "NOT_ASSIGNEE") return "FORBIDDEN";
  if (block === "ASSIGNEE_NOT_REVIEWER" || INPUT_BLOCKS.has(block)) return "BAD_REQUEST";
  return "CONFLICT";
}

/** The slice of an application the rules read. */
export interface ApplicationForTransition {
  status: Status;
  assignedReviewerId: string | null;
  reviewerRecommendation: string | null;
  contractFilename: string | null;
  approvedAmount: number | null;
  /**
   * Terms stored when the contract is generated in this flow. Null on a
   * contract signed before it (a migrated SIGNED application), whose loan terms
   * the operator still enters at disbursement.
   */
  contractTerms: unknown;
}

export interface TransitionActor {
  id: string;
  roles: readonly Role[];
}

/** Evidence completeness, computed by `evidenceStatus`. */
export interface EvidenceStatus {
  /** The business location, stored as a map link (`mapUrl`). */
  location: boolean;
  idFront: boolean;
  idBack: boolean;
  businessPhotos: { have: number; need: number };
  complete: boolean;
}

/** Everything a caller may supply with an action; each rule reads its own fields. */
export interface TransitionInput {
  /** assign: target user; defaults to the actor. */
  assigneeId?: string;
  /** assign: the target user's roles (the server looks them up). */
  assigneeRoles?: readonly Role[];
  /** returnToReviewer (required), reject (required for OTHER), approve (optional). */
  note?: string | null;
  reason?: RejectionReason | null;
  approvedAmount?: number | null;
  approvedTermWeeks?: number | null;
  /** convert: the loan principal; must equal the approved amount. */
  principal?: number | null;
}

export interface TransitionContext {
  /** Required to evaluate `sendToDecision`. */
  evidence?: EvidenceStatus;
}

export interface EvaluateOptions {
  /** Skip blocks that depend only on caller input (see INPUT_BLOCKS). */
  ignoreInput?: boolean;
}

export type TransitionResult = { ok: true; to: Status } | { ok: false; reason: TransitionBlock };

const isReviewer = (a: TransitionActor) =>
  a.roles.includes("REVIEWER") || a.roles.includes("ADMIN");
const isAdmin = (a: TransitionActor) => a.roles.includes("ADMIN");
const hasText = (s: string | null | undefined) => typeof s === "string" && s.trim().length > 0;
const positive = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

/** Source statuses per action (the rule bodies below re-check who may act from each). */
export const ACTION_SOURCE_STATUSES: Record<ReviewAction, readonly Status[]> = {
  promote: ["DRAFT"],
  assign: ["RECEIVED", "IN_REVIEW"],
  sendToDecision: ["IN_REVIEW"],
  returnToReviewer: ["PENDING_DECISION"],
  approve: ["PENDING_DECISION"],
  reject: ["IN_REVIEW", "PENDING_DECISION"],
  withdraw: ["APPROVED"],
  convert: ["APPROVED"]
};

const ACTION_TARGET: Record<ReviewAction, Status> = {
  promote: "RECEIVED",
  assign: "IN_REVIEW",
  sendToDecision: "PENDING_DECISION",
  returnToReviewer: "IN_REVIEW",
  approve: "APPROVED",
  reject: "REJECTED",
  withdraw: "ABANDONED",
  convert: "CONVERTED"
};

type RuleCheck = (
  app: ApplicationForTransition,
  actor: TransitionActor,
  input: TransitionInput,
  ctx: TransitionContext
) => TransitionBlock | null;

/** Who may act, per action and (where it matters) per source status. */
const WHO: Record<ReviewAction, RuleCheck> = {
  promote: () => null,
  assign: (app, actor, input) => {
    const target = input.assigneeId ?? actor.id;
    const self = target === actor.id;
    // Taking from the queue is open to any reviewer; assigning someone else or
    // moving an application that is already in review is an admin call.
    if ((!self || app.status === "IN_REVIEW") && !isAdmin(actor)) return "NOT_ALLOWED";
    return null;
  },
  sendToDecision: (app, actor) => (app.assignedReviewerId === actor.id ? null : "NOT_ASSIGNEE"),
  returnToReviewer: (_app, actor) => (isAdmin(actor) ? null : "NOT_ALLOWED"),
  approve: (_app, actor) => (isAdmin(actor) ? null : "NOT_ALLOWED"),
  reject: (app, actor) => {
    if (app.status === "PENDING_DECISION") return isAdmin(actor) ? null : "NOT_ALLOWED";
    return app.assignedReviewerId === actor.id ? null : "NOT_ASSIGNEE";
  },
  withdraw: (app, actor) =>
    app.assignedReviewerId === actor.id || isAdmin(actor) ? null : "NOT_ASSIGNEE",
  convert: (app, actor) =>
    app.assignedReviewerId === actor.id || isAdmin(actor) ? null : "NOT_ASSIGNEE"
};

/** What must be true (state first, then input) for the action to go through. */
const REQUIRES: Record<ReviewAction, RuleCheck> = {
  promote: () => null,
  assign: (_app, actor, input) => {
    const roles =
      input.assigneeId && input.assigneeId !== actor.id ? input.assigneeRoles : actor.roles;
    const ok = roles?.includes("REVIEWER") || roles?.includes("ADMIN");
    return ok ? null : "ASSIGNEE_NOT_REVIEWER";
  },
  sendToDecision: (app, _actor, _input, ctx) => {
    if (!ctx.evidence?.complete) return "EVIDENCE_INCOMPLETE";
    if (!hasText(app.reviewerRecommendation)) return "RECOMMENDATION_REQUIRED";
    return null;
  },
  returnToReviewer: (_app, _actor, input) => (hasText(input.note) ? null : "NOTE_REQUIRED"),
  approve: (_app, _actor, input) =>
    positive(input.approvedAmount) &&
    positive(input.approvedTermWeeks) &&
    Number.isInteger(input.approvedTermWeeks)
      ? null
      : "TERMS_REQUIRED",
  reject: (_app, _actor, input) => {
    if (!input.reason) return "REASON_REQUIRED";
    if (input.reason === "OTHER" && !hasText(input.note)) return "NOTE_REQUIRED";
    return null;
  },
  withdraw: () => null,
  convert: (app, _actor, input) => {
    if (!app.contractFilename) return "CONTRACT_REQUIRED";
    if (app.approvedAmount == null) {
      // Only an approval from before this flow lacks an amount. With its
      // pre-flow signed contract, the operator's principal stands (as it did).
      return app.contractTerms == null && positive(input.principal) ? null : "TERMS_REQUIRED";
    }
    if (input.principal != null && input.principal !== app.approvedAmount) return "AMOUNT_MISMATCH";
    return null;
  }
};

/**
 * Decide whether `actor` may perform `action` on `app` right now.
 *
 * Checks run in a fixed order so the reason is the most useful one: a caller
 * with no review role at all → NOT_ALLOWED; wrong source status →
 * WRONG_STATUS; then who may act from that status; then state and input
 * requirements.
 */
export function evaluateTransition(
  app: ApplicationForTransition,
  action: ReviewAction,
  actor: TransitionActor,
  input: TransitionInput = {},
  ctx: TransitionContext = {},
  options: EvaluateOptions = {}
): TransitionResult {
  if (!isReviewer(actor)) return { ok: false, reason: "NOT_ALLOWED" };
  if (!ACTION_SOURCE_STATUSES[action].includes(app.status)) {
    return { ok: false, reason: "WRONG_STATUS" };
  }
  const who = WHO[action](app, actor, input, ctx);
  if (who) return { ok: false, reason: who };
  const req = REQUIRES[action](app, actor, input, ctx);
  if (req && !(options.ignoreInput && INPUT_BLOCKS.has(req))) return { ok: false, reason: req };
  return { ok: true, to: ACTION_TARGET[action] };
}

/**
 * Evidence completeness: the business location (map link), both cédula sides,
 * and at least `minBusinessPhotos` business photos. The recommendation is
 * checked separately by `sendToDecision` so the UI can name each missing piece.
 */
export function evidenceStatus(
  app: { mapUrl: string | null; idFrontFilename: string | null; idBackFilename: string | null },
  businessPhotoCount: number,
  minBusinessPhotos: number
): EvidenceStatus {
  const location = Boolean(app.mapUrl);
  const idFront = Boolean(app.idFrontFilename);
  const idBack = Boolean(app.idBackFilename);
  const businessPhotos = { have: businessPhotoCount, need: minBusinessPhotos };
  return {
    location,
    idFront,
    idBack,
    businessPhotos,
    complete: location && idFront && idBack && businessPhotoCount >= minBusinessPhotos
  };
}

/**
 * Evidence progress as counted pieces: the location, each cédula side, and
 * each required photo (extra photos don't count past the minimum). Drives the
 * collector list's "1 de 6".
 */
export function evidenceProgress(e: EvidenceStatus): { have: number; need: number } {
  const photos = Math.min(e.businessPhotos.have, e.businessPhotos.need);
  return {
    have: Number(e.location) + Number(e.idFront) + Number(e.idBack) + photos,
    need: 3 + e.businessPhotos.need
  };
}

/** Default minimum business photos when `applications.minBusinessPhotos` is unset. */
export const DEFAULT_MIN_BUSINESS_PHOTOS = 3;
