/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Review-lifecycle mutations. Every one of them authorizes through
 * `evaluateTransition` (@mikro/common) — the same rules the founder app uses to
 * enable its buttons — and persists with a conditional update on the status it
 * read, so two people acting on the same application at once cannot both win.
 */
import {
  evaluateTransition,
  evidenceStatus,
  transitionBlockCode,
  TRANSITION_BLOCK_LABELS
} from "@mikro/common";
import type {
  ApplicationForTransition,
  ApproveApplicationInput,
  AssignApplicationInput,
  DbClient,
  EvidenceStatus,
  LoanApplication,
  LoanApplicationWriteData,
  RejectApplicationInput,
  ReturnToReviewerInput,
  ReviewAction,
  Role,
  SendToDecisionInput,
  SetRecommendationInput,
  TransitionActor,
  TransitionInput,
  WithdrawApplicationInput
} from "@mikro/common";
import { TRPCError } from "@trpc/server";
import { logger } from "../../logger.js";
import { createCancelApplicationJobs } from "../../follow-up/index.js";

export interface ApplicationRef {
  id?: string;
  sessionId?: string;
}

export async function loadApplication(
  client: DbClient,
  ref: ApplicationRef
): Promise<LoanApplication> {
  const app = ref.id
    ? await client.loanApplication.findUnique({ where: { id: ref.id } })
    : await client.loanApplication.findFirst({ where: { sessionId: ref.sessionId! } });
  if (!app) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Loan application not found" });
  }
  return app;
}

/** Prisma returns Decimal for money columns; the rules compare plain numbers. */
function toNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function forTransition(app: LoanApplication): ApplicationForTransition {
  return {
    status: app.status,
    assignedReviewerId: app.assignedReviewerId,
    reviewerRecommendation: app.reviewerRecommendation,
    contractFilename: app.contractFilename,
    approvedAmount: toNumber(app.approvedAmount),
    contractTerms: app.contractTerms
  };
}

/** Evidence completeness for an application (cédula slots + business photo count). */
export async function loadEvidenceStatus(
  client: DbClient,
  app: LoanApplication,
  minBusinessPhotos: number
): Promise<EvidenceStatus> {
  const photos = await client.applicationDocument.count({
    where: { applicationId: app.id, kind: "BUSINESS_PHOTO" }
  });
  return evidenceStatus(app, photos, minBusinessPhotos);
}

/**
 * Throw the tRPC error for a blocked transition, or return the target status.
 * The message leads with the Spanish label (shown by the UI) and keeps the
 * machine-readable code and current status for logs and tests.
 */
export function authorize(
  app: LoanApplication,
  action: ReviewAction,
  actor: TransitionActor,
  input: TransitionInput = {},
  evidence?: EvidenceStatus
): LoanApplication["status"] {
  const result = evaluateTransition(forTransition(app), action, actor, input, { evidence });
  if (!result.ok) {
    throw new TRPCError({
      code: transitionBlockCode(result.reason),
      message: `${TRANSITION_BLOCK_LABELS[result.reason]} [${result.reason}: cannot ${action} an application in status ${app.status}]`
    });
  }
  return result.to;
}

/**
 * Persist a transition only if the row still has the status (and assignee) we
 * evaluated against. A concurrent change makes the update match zero rows,
 * which becomes a CONFLICT instead of silently overwriting the other person.
 */
async function commitTransition(
  client: DbClient,
  app: LoanApplication,
  data: Partial<LoanApplicationWriteData>
): Promise<LoanApplication> {
  const { count } = await client.loanApplication.updateMany({
    where: { id: app.id, status: app.status, assignedReviewerId: app.assignedReviewerId },
    data
  });
  if (count === 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "La solicitud cambió mientras la revisabas; recarga e intenta de nuevo."
    });
  }
  const updated = await client.loanApplication.findUnique({ where: { id: app.id } });
  return updated!;
}

function cancelFollowUps(client: DbClient, app: LoanApplication): void {
  if (app.status !== "RECEIVED") return;
  createCancelApplicationJobs(client)(app.id).catch((err: Error) => {
    logger.error("failed to cancel follow-up jobs on review", {
      applicationId: app.id,
      error: err.message
    });
  });
}

async function loadRoles(client: DbClient, userId: string): Promise<Role[] | null> {
  const user = await client.user.findUnique({
    where: { id: userId },
    include: { roles: { select: { role: true } } }
  });
  return user ? (user.roles ?? []).map((r) => r.role) : null;
}

/**
 * Assign an application: take it from the queue (no `assigneeId`), or — admins
 * only — assign it to another reviewer, or reassign one already in review.
 */
export function createAssignApplication(client: DbClient) {
  return async (
    input: AssignApplicationInput,
    actor: TransitionActor
  ): Promise<LoanApplication> => {
    const app = await loadApplication(client, input);
    const assigneeId = input.assigneeId ?? actor.id;
    const assigneeRoles =
      assigneeId === actor.id ? actor.roles : await loadRoles(client, assigneeId);
    if (!assigneeRoles) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Assignee not found" });
    }
    const to = authorize(app, "assign", actor, { assigneeId, assigneeRoles });
    const updated = await commitTransition(client, app, {
      status: to,
      assignedReviewerId: assigneeId,
      assignedAt: new Date()
    });
    cancelFollowUps(client, app);
    logger.verbose("application assigned", {
      id: app.id,
      assigneeId,
      by: actor.id,
      from: app.status
    });
    return updated;
  };
}

/** The assigned reviewer's recommendation to the admin. Editable only while IN_REVIEW. */
export function createSetRecommendation(client: DbClient) {
  return async (
    input: SetRecommendationInput,
    actor: TransitionActor
  ): Promise<LoanApplication> => {
    const app = await loadApplication(client, input);
    assertEvidenceWritable(app, actor);
    return client.loanApplication.update({
      where: { id: app.id },
      data: { reviewerRecommendation: input.reviewerRecommendation || null }
    });
  };
}

/**
 * Guard for everything the reviewer edits while gathering evidence: data,
 * recommendation, cédula and documents. Allowed only IN_REVIEW, only for the
 * assignee — which is also what locks evidence once it goes to decision.
 */
export function assertEvidenceWritable(app: LoanApplication, actor: TransitionActor): void {
  const isReviewer = actor.roles.includes("REVIEWER") || actor.roles.includes("ADMIN");
  if (!isReviewer) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Reviewer or admin role required" });
  }
  if (app.status !== "IN_REVIEW") {
    throw new TRPCError({
      code: "CONFLICT",
      message: `${TRANSITION_BLOCK_LABELS.WRONG_STATUS} [WRONG_STATUS: evidence and data are editable only IN_REVIEW, application is ${app.status}]`
    });
  }
  if (app.assignedReviewerId !== actor.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: TRANSITION_BLOCK_LABELS.NOT_ASSIGNEE });
  }
}

/** Assignee hands a complete application (evidence + recommendation) to the admin. */
export function createSendToDecision(client: DbClient, opts: { minBusinessPhotos: number }) {
  return async (input: SendToDecisionInput, actor: TransitionActor): Promise<LoanApplication> => {
    const app = await loadApplication(client, input);
    const evidence = await loadEvidenceStatus(client, app, opts.minBusinessPhotos);
    const to = authorize(app, "sendToDecision", actor, {}, evidence);
    return commitTransition(client, app, { status: to, sentToDecisionAt: new Date() });
  };
}

/** Admin sends a pending application back to its reviewer, with a note. */
export function createReturnToReviewer(client: DbClient) {
  return async (input: ReturnToReviewerInput, actor: TransitionActor): Promise<LoanApplication> => {
    const app = await loadApplication(client, input);
    const to = authorize(app, "returnToReviewer", actor, { note: input.note });
    return commitTransition(client, app, {
      status: to,
      decidedById: actor.id,
      decidedAt: new Date(),
      decisionNote: input.note
    });
  };
}

/** Admin approves a pending application with the terms that will be lent. */
export function createApproveApplication(client: DbClient) {
  return async (
    input: ApproveApplicationInput,
    actor: TransitionActor
  ): Promise<LoanApplication> => {
    const app = await loadApplication(client, input);
    const to = authorize(app, "approve", actor, {
      approvedAmount: input.approvedAmount,
      approvedTermWeeks: input.approvedTermWeeks
    });
    return commitTransition(client, app, {
      status: to,
      approvedAmount: input.approvedAmount,
      approvedTermWeeks: input.approvedTermWeeks,
      decidedById: actor.id,
      decidedAt: new Date(),
      decisionNote: input.note || null
    });
  };
}

/** Reject with a reason: the assignee while IN_REVIEW, an admin while PENDING_DECISION. */
export function createRejectApplication(client: DbClient) {
  return async (
    input: RejectApplicationInput,
    actor: TransitionActor
  ): Promise<LoanApplication> => {
    const app = await loadApplication(client, input);
    const to = authorize(app, "reject", actor, { reason: input.reason, note: input.note });
    return commitTransition(client, app, {
      status: to,
      rejectionReason: input.reason,
      decidedById: actor.id,
      decidedAt: new Date(),
      decisionNote: input.note || null
    });
  };
}

/** The customer backed out after approval (APPROVED → ABANDONED). */
export function createWithdrawApplication(client: DbClient) {
  return async (
    input: WithdrawApplicationInput,
    actor: TransitionActor
  ): Promise<LoanApplication> => {
    const app = await loadApplication(client, input);
    const to = authorize(app, "withdraw", actor);
    return commitTransition(client, app, { status: to });
  };
}

/** Build the transition actor for a user id from their stored roles. */
export async function loadActor(client: DbClient, userId: string): Promise<TransitionActor> {
  const roles = await loadRoles(client, userId);
  if (!roles) throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
  return { id: userId, roles };
}

/**
 * Founder-copilot adapters. The copilot's approve/reject tools (mods/agents)
 * predate the decision step: approve carries no terms and reject carries free
 * text. The confirming founder is the actor, so the same rules apply (admin,
 * PENDING_DECISION only); approve lends the requested terms and reject files
 * the text under reason OTHER. The dashboard is the path for adjusted terms.
 */
export function createCopilotApproveApplication(client: DbClient) {
  const approve = createApproveApplication(client);
  return async (
    input: { id?: string; sessionId?: string; note?: string },
    reviewerId: string
  ): Promise<LoanApplication> => {
    const app = await loadApplication(client, input);
    const approvedAmount = toNumber(app.requestedAmount);
    const approvedTermWeeks = app.requestedTermWeeks;
    if (!approvedAmount || !approvedTermWeeks) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "La solicitud no tiene monto y plazo pedidos; apruébala desde el feed indicando los términos."
      });
    }
    return approve(
      { id: app.id, approvedAmount, approvedTermWeeks, note: input.note },
      await loadActor(client, reviewerId)
    );
  };
}

export function createCopilotRejectApplication(client: DbClient) {
  const reject = createRejectApplication(client);
  return async (
    input: { id?: string; sessionId?: string; reason: string },
    reviewerId: string
  ): Promise<LoanApplication> =>
    reject(
      { id: input.id, sessionId: input.sessionId, reason: "OTHER", note: input.reason },
      await loadActor(client, reviewerId)
    );
}

/**
 * Guard for the post-approval paperwork (signed contract upload/removal): the
 * application must be APPROVED and the caller its assignee or an admin — the
 * same people the transition table lets convert or withdraw it.
 */
export function assertApprovedStepWritable(app: LoanApplication, actor: TransitionActor): void {
  const isReviewer = actor.roles.includes("REVIEWER") || actor.roles.includes("ADMIN");
  if (!isReviewer) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Reviewer or admin role required" });
  }
  if (app.status !== "APPROVED") {
    throw new TRPCError({
      code: "CONFLICT",
      message: `${TRANSITION_BLOCK_LABELS.WRONG_STATUS} [WRONG_STATUS: the signed contract is handled only while APPROVED, application is ${app.status}]`
    });
  }
  if (app.assignedReviewerId !== actor.id && !actor.roles.includes("ADMIN")) {
    throw new TRPCError({ code: "FORBIDDEN", message: TRANSITION_BLOCK_LABELS.NOT_ASSIGNEE });
  }
}
