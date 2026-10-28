/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  ValidationError,
  finalizeLoanRenewalSchema,
  renewalNet,
  type DbClient,
  type FinalizeLoanRenewalInput,
  type Loan,
  type RenewalActor
} from "@mikro/common";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { logger } from "../../logger.js";
import { postTransactionCore } from "../accounting/postTransaction.js";
import { resolveDisbursementAccountId } from "../applications/disbursementAccounts.js";
import { formatDop } from "../events/helpers.js";
import { createCreateLoan } from "../loans/createCreateLoan.js";
import {
  decide,
  emitRenewalEvent,
  loadRenewal,
  owedNow,
  viewOf,
  type LoanRenewalView
} from "./support.js";

export interface FinalizeLoanRenewalResult {
  renewal: LoanRenewalView;
  oldLoanId: number;
  newLoan: Loan;
  owed: number;
  disbursement: {
    transactionId: string;
    accountId: string;
    accountName: string;
    amount: number;
  };
}

export interface FinalizeLoanRenewalDeps {
  resolveAccountId?: typeof resolveDisbursementAccountId;
  now?: () => Date;
}

/**
 * Close the deal, atomically. Inside ONE transaction:
 *
 * 1. recompute what the customer owes on the old loan from its live snapshot
 *    and compare the resulting net with the `confirmedNet` the user accepted —
 *    a mismatch (mora accrued, a payment arrived) throws `NET_CHANGED` and the
 *    whole transaction rolls back, writing nothing;
 * 2. renewal SIGNED → COMPLETED (guarded, so two finalizes cannot both win);
 * 3. old loan ACTIVE → RENEWED with `closedAt` (guarded);
 * 4. the new loan from the renewal's STORED terms, linked via `renewedFromLoanId`;
 * 5. one WITHDRAWAL of `principal − owed` — the cash that actually leaves;
 * 6. the renewal's documents re-point to the new loan;
 * 7. a `loan.renewal.completed` event.
 *
 * What was owed only decides the ledger amount; it never touches the terms.
 */
export function createFinalizeLoanRenewal(
  client: PrismaClient,
  deps: FinalizeLoanRenewalDeps = {}
) {
  const resolveAccountId = deps.resolveAccountId ?? resolveDisbursementAccountId;
  const now = deps.now ?? (() => new Date());

  return async (
    raw: FinalizeLoanRenewalInput,
    actor: RenewalActor
  ): Promise<FinalizeLoanRenewalResult> => {
    const parsed = finalizeLoanRenewalSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(parsed.error);
    const input = parsed.data;
    const accountId = resolveAccountId(input.accountId);
    const at = now();

    return client.$transaction(async (tx) => {
      const renewal = await loadRenewal(tx, input.id);
      const principal = Number(renewal.principal);
      const { owed } = await owedNow(tx, renewal.loan.loanId);
      const net = renewalNet(principal, owed);

      decide(
        renewal,
        "finalize",
        actor,
        { principal, confirmedNet: input.confirmedNet },
        {
          owed,
          oldLoanActive: renewal.loan.status === "ACTIVE"
        }
      );

      const done = await tx.loanRenewal.updateMany({
        where: { id: renewal.id, status: "SIGNED" },
        data: { status: "COMPLETED", openKey: null, completedAt: at }
      });
      if (done.count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "La renovación cambió mientras la finalizabas; recarga e intenta de nuevo."
        });
      }
      const closed = await tx.loan.updateMany({
        where: { id: renewal.loan.id, status: "ACTIVE" },
        data: { status: "RENEWED", closedAt: at }
      });
      if (closed.count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `El préstamo #${renewal.loan.loanId} cambió mientras lo renovabas; recarga e intenta de nuevo.`
        });
      }

      // The renewal contract printed this date as the first cuota
      // (createGenerateRenewalContract: startingDate ?? generation time).
      const created = await createCreateLoan(
        tx as unknown as DbClient,
        "renewal"
      )({
        customerId: renewal.customerId,
        principal,
        termLength: renewal.termLength,
        paymentAmount: Number(renewal.paymentAmount),
        paymentFrequency: renewal.paymentFrequency,
        firstDueDate: renewal.startingDate ?? renewal.contractGeneratedAt ?? at,
        nickname: renewal.nickname ?? undefined,
        moraRate: renewal.moraRate == null ? undefined : Number(renewal.moraRate)
      });
      const newLoan = (await tx.loan.update({
        where: { id: created.id },
        data: { renewedFromLoanId: renewal.loan.id }
      })) as unknown as Loan;

      const disbursement = await postTransactionCore(tx as unknown as PrismaClient, {
        type: "WITHDRAWAL",
        accountId,
        amount: net,
        occurredAt: at,
        description: `Renovación préstamo #${renewal.loan.loanId} → #${newLoan.loanId} para ${renewal.customer.name} (saldo ${formatDop(owed)})`,
        reference: `loan-renewal:${newLoan.loanId}`,
        createdById: actor.id
      });

      await tx.customerDocument.updateMany({
        where: { renewalId: renewal.id },
        data: { loanId: newLoan.id }
      });
      await tx.loanRenewal.update({
        where: { id: renewal.id },
        data: {
          newLoanId: newLoan.id,
          ledgerTransactionId: disbursement.id,
          quotedOwed: owed,
          quotedNet: net,
          quotedAt: at
        }
      });

      const final = await loadRenewal(tx, renewal.id);
      await emitRenewalEvent(
        tx,
        "loan.renewal.completed",
        actor,
        final,
        "completó la renovación",
        {
          newLoanId: newLoan.id,
          newLoanNumber: newLoan.loanId,
          owed,
          netDisbursed: net,
          transactionId: disbursement.id,
          accountName: disbursement.account.name
        },
        net
      );

      logger.verbose("loan renewal finalized", {
        renewalId: renewal.id,
        oldLoanId: renewal.loan.loanId,
        newLoanId: newLoan.loanId,
        owed,
        net,
        transactionId: disbursement.id
      });

      return {
        renewal: viewOf(final),
        oldLoanId: renewal.loan.loanId,
        newLoan,
        owed,
        disbursement: {
          transactionId: disbursement.id,
          accountId: disbursement.account.id,
          accountName: disbursement.account.name,
          amount: net
        }
      };
    });
  };
}
