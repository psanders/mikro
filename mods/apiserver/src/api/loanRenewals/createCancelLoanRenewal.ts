/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  ValidationError,
  cancelLoanRenewalSchema,
  type CancelLoanRenewalInput,
  type RenewalActor
} from "@mikro/common";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { decide, emitRenewalEvent, loadRenewal, viewOf, type LoanRenewalView } from "./support.js";

/**
 * Cancel a renewal at any point before it completes. Nothing else was written
 * during the process, so there is nothing to undo: the old loan stays ACTIVE,
 * no loan is created and the ledger is untouched. Clearing `open_key` frees the
 * loan for a new renewal; the uploaded documents stay with the customer, linked
 * to the cancelled renewal.
 */
export function createCancelLoanRenewal(client: PrismaClient, deps: { now?: () => Date } = {}) {
  const now = deps.now ?? (() => new Date());

  return async (raw: CancelLoanRenewalInput, actor: RenewalActor): Promise<LoanRenewalView> => {
    const parsed = cancelLoanRenewalSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(parsed.error);
    const input = parsed.data;

    const renewal = await loadRenewal(client, input.id);
    const to = decide(renewal, "cancel", actor);

    const updated = await client.$transaction(async (tx) => {
      const { count } = await tx.loanRenewal.updateMany({
        where: { id: renewal.id, status: renewal.status },
        data: {
          status: to,
          openKey: null,
          cancelledAt: now(),
          cancelReason: input.reason ?? null
        }
      });
      if (count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "La renovación cambió mientras la cancelabas; recarga e intenta de nuevo."
        });
      }
      const r = await loadRenewal(tx, renewal.id);
      await emitRenewalEvent(tx, "loan.renewal.cancelled", actor, r, "canceló la renovación", {
        ...(input.reason ? { reason: input.reason } : {})
      });
      return r;
    });
    return viewOf(updated);
  };
}
