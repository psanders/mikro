/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  ValidationError,
  renewalNet,
  updateRenewalTermsSchema,
  type RenewalActor,
  type UpdateRenewalTermsInput
} from "@mikro/common";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  decide,
  emitRenewalEvent,
  loadRenewal,
  owedNow,
  viewOf,
  type LoanRenewalView
} from "./support.js";

/**
 * Change a renewal's proposed terms. Terms feed the contract, so any change
 * invalidates it: the generated and signed contracts are dropped and the
 * renewal returns to DRAFT. The principal must still cover what is owed.
 */
export function createUpdateRenewalTerms(client: PrismaClient, deps: { now?: () => Date } = {}) {
  const now = deps.now ?? (() => new Date());

  return async (raw: UpdateRenewalTermsInput, actor: RenewalActor): Promise<LoanRenewalView> => {
    const parsed = updateRenewalTermsSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(parsed.error);
    const { id, terms } = parsed.data;

    const renewal = await loadRenewal(client, id);
    const principal = terms.principal ?? Number(renewal.principal);
    const { owed } = await owedNow(client, renewal.loan.loanId);
    decide(
      renewal,
      "updateTerms",
      actor,
      { principal },
      {
        owed,
        oldLoanActive: renewal.loan.status === "ACTIVE"
      }
    );
    const net = renewalNet(principal, owed);

    const stale = [renewal.contractFilename, renewal.signedContractFilename].filter(
      (f): f is string => Boolean(f)
    );

    const updated = await client.$transaction(async (tx) => {
      const { count } = await tx.loanRenewal.updateMany({
        where: { id, status: renewal.status },
        data: {
          status: "DRAFT",
          ...(terms.principal !== undefined ? { principal: terms.principal } : {}),
          ...(terms.termLength !== undefined ? { termLength: terms.termLength } : {}),
          ...(terms.paymentAmount !== undefined ? { paymentAmount: terms.paymentAmount } : {}),
          ...(terms.paymentFrequency !== undefined
            ? { paymentFrequency: terms.paymentFrequency }
            : {}),
          ...(terms.startingDate !== undefined ? { startingDate: terms.startingDate } : {}),
          ...(terms.nickname !== undefined ? { nickname: terms.nickname } : {}),
          ...(terms.moraRate !== undefined ? { moraRate: terms.moraRate } : {}),
          contractFilename: null,
          contractGeneratedAt: null,
          signedContractFilename: null,
          quotedOwed: owed,
          quotedNet: net,
          quotedAt: now()
        }
      });
      if (count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "La renovación cambió mientras la editabas; recarga e intenta de nuevo."
        });
      }
      if (stale.length > 0) {
        await tx.customerDocument.deleteMany({
          where: { renewalId: id, filename: { in: stale } }
        });
      }
      const r = await loadRenewal(tx, id);
      await emitRenewalEvent(
        tx,
        "loan.renewal.terms_updated",
        actor,
        r,
        "cambió los términos de la renovación"
      );
      return r;
    });
    return viewOf(updated);
  };
}
