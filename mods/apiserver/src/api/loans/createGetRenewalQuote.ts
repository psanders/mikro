/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * What a customer still owes on an ACTIVE loan, for renewing it mid-term
 * (openspec add-loan-renewal). Read-only: the canonical snapshot's
 * remaining balance plus net accrued mora is the suggested payoff the renewal
 * form starts from; the operator may still negotiate it down.
 */
import {
  withErrorHandlingAndValidation,
  getRenewalQuoteSchema,
  type GetRenewalQuoteInput,
  type DbClient,
  type PaymentFrequency
} from "@mikro/common";
import { TRPCError } from "@trpc/server";
import { buildLoanSnapshotFromDb } from "./buildLoanSnapshotFromDb.js";

export interface RenewalQuote {
  loanId: number;
  customer: { id: string; name: string };
  currentTerms: {
    principal: number;
    termLength: number;
    paymentAmount: number;
    paymentFrequency: PaymentFrequency;
  };
  cuotasCovered: number;
  remainingBalance: number;
  moraAccrued: number;
  /** remainingBalance + moraAccrued, rounded to cents. */
  suggestedPayoff: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function createGetRenewalQuote(client: DbClient) {
  const fn = async (params: GetRenewalQuoteInput): Promise<RenewalQuote> => {
    const snapshot = await buildLoanSnapshotFromDb(client, params.loanId);
    if (!snapshot) {
      throw new TRPCError({ code: "NOT_FOUND", message: `Préstamo #${params.loanId} no existe.` });
    }
    if (snapshot.terms.status !== "ACTIVE") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Solo se puede renovar un préstamo activo (#${params.loanId} está ${snapshot.terms.status}).`
      });
    }
    const { remainingBalance, moraAccrued, cuotasCovered } = snapshot.derived;
    return {
      loanId: snapshot.loanId,
      customer: { id: snapshot.customer.id, name: snapshot.customer.name },
      currentTerms: {
        principal: snapshot.terms.principal,
        termLength: snapshot.terms.termLength,
        paymentAmount: snapshot.terms.cuota,
        paymentFrequency: snapshot.terms.paymentFrequency as PaymentFrequency
      },
      cuotasCovered,
      remainingBalance: round2(remainingBalance),
      moraAccrued: round2(moraAccrued),
      suggestedPayoff: round2(remainingBalance + moraAccrued)
    };
  };

  return withErrorHandlingAndValidation(fn, getRenewalQuoteSchema);
}
