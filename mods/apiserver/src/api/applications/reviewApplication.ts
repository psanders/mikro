/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { resolveReviewTransition } from "@mikro/common";
import type {
  DbClient,
  LoanApplication,
  ReviewAction,
  ClaimApplicationInput,
  ApproveApplicationInput,
  RejectApplicationInput,
  ReopenApplicationInput
} from "@mikro/common";
import { TRPCError } from "@trpc/server";
import { logger } from "../../logger.js";
import { createCancelApplicationJobs } from "../../follow-up/index.js";

interface ApplicationRef {
  id?: string;
  sessionId?: string;
}

async function loadByRef(client: DbClient, ref: ApplicationRef): Promise<LoanApplication> {
  const app = ref.id
    ? await client.loanApplication.findUnique({ where: { id: ref.id } })
    : await client.loanApplication.findFirst({ where: { sessionId: ref.sessionId! } });
  if (!app) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Loan application not found" });
  }
  return app;
}

/**
 * Apply a review action to an application: validate the current->next transition,
 * then persist the new status + the reviewer decision (who/when/note).
 * Cancels any pending follow-up jobs when the application moves out of RECEIVED.
 */
async function applyReview(
  client: DbClient,
  action: ReviewAction,
  ref: ApplicationRef,
  reviewerId: string,
  note: string | null
): Promise<LoanApplication> {
  const app = await loadByRef(client, ref);
  const to = resolveReviewTransition(action, app.status);
  if (!to) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Cannot ${action} an application in status ${app.status}.`
    });
  }
  const updated = await client.loanApplication.update({
    where: { id: app.id },
    data: { status: to, reviewedById: reviewerId, reviewedAt: new Date(), reviewNote: note }
  });

  if (app.status === "RECEIVED") {
    const cancelJobs = createCancelApplicationJobs(client);
    cancelJobs(app.id).catch((err: Error) => {
      logger.error("failed to cancel follow-up jobs on review", {
        applicationId: app.id,
        error: err.message
      });
    });
  }

  logger.verbose("loan application reviewed", {
    id: app.id,
    action,
    from: app.status,
    to,
    reviewerId
  });
  return updated;
}

export function createClaimApplication(client: DbClient) {
  return (input: ClaimApplicationInput, reviewerId: string): Promise<LoanApplication> =>
    applyReview(client, "claim", input, reviewerId, null);
}

export function createApproveApplication(client: DbClient) {
  return (input: ApproveApplicationInput, reviewerId: string): Promise<LoanApplication> =>
    applyReview(client, "approve", input, reviewerId, input.note ?? null);
}

export function createRejectApplication(client: DbClient) {
  return (input: RejectApplicationInput, reviewerId: string): Promise<LoanApplication> =>
    applyReview(client, "reject", input, reviewerId, input.reason);
}

export function createReopenApplication(client: DbClient) {
  return (input: ReopenApplicationInput, reviewerId: string): Promise<LoanApplication> =>
    applyReview(client, "reopen", input, reviewerId, input.note ?? null);
}
