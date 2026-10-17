/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Renew a loan mid-term (openspec add-loan-renewal, issue #334): the customer
 * still owes `payoffAmount` on the old loan, so the new loan carries the full
 * requested principal but only `principal − payoffAmount` leaves the account.
 */
import {
  ValidationError,
  renewLoanSchema,
  type DbClient,
  type Loan,
  type RenewLoanInput,
  type TransitionActor
} from "@mikro/common";
import { TRPCError } from "@trpc/server";
import { createCreateLoan } from "./createCreateLoan.js";
import { postTransactionCore } from "../accounting/postTransaction.js";
import { resolveDisbursementAccountId } from "../applications/disbursementAccounts.js";
import {
  renderAndStoreCustomerContract,
  type GeneratedContract
} from "../customers/createGenerateCustomerContract.js";
import { recordEvent } from "../events/recordEvent.js";
import { formatDop, resolveActorName } from "../events/helpers.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { logger } from "../../logger.js";

export interface RenewLoanResult {
  oldLoanId: number;
  newLoan: Loan;
  payoff: number;
  disbursement: {
    transactionId: string;
    accountId: string;
    accountName: string;
    amount: number;
  };
  contract?: GeneratedContract;
}

export interface RenewLoanDeps {
  renderContract?: typeof renderAndStoreCustomerContract;
  resolveAccountId?: typeof resolveDisbursementAccountId;
  now?: () => Date;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Close `loanId` as RENEWED and open its replacement, atomically:
 *
 * 1. old loan → RENEWED with `closedAt` (only if still ACTIVE — race guard);
 * 2. new loan for the same customer, full principal, `renewedFromLoanId` set;
 * 3. one WITHDRAWAL of the NET amount (principal − payoff) — the cash that
 *    actually leaves; the payoff never touched the till, so no DEPOSIT;
 * 4. when requested, the new contract as a CustomerDocument tied to the new loan;
 * 5. a `loan.renewed` business event.
 *
 * The contract PDF is rendered and stored (content-addressed) before the
 * transaction; its row is written inside it, so a rollback leaves no record.
 */
export function createRenewLoan(client: PrismaClient, deps: RenewLoanDeps = {}) {
  const renderContract = deps.renderContract ?? renderAndStoreCustomerContract;
  const resolveAccountId = deps.resolveAccountId ?? resolveDisbursementAccountId;
  const now = deps.now ?? (() => new Date());

  return async (raw: RenewLoanInput, actor: TransitionActor): Promise<RenewLoanResult> => {
    const parsed = renewLoanSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError(parsed.error);
    }
    const input = parsed.data;

    const old = await client.loan.findUnique({
      where: { loanId: input.loanId },
      include: { customer: true }
    });
    if (!old) {
      throw new TRPCError({ code: "NOT_FOUND", message: `Préstamo #${input.loanId} no existe.` });
    }
    if (old.status !== "ACTIVE") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Solo se puede renovar un préstamo activo (#${input.loanId} está ${old.status}).`
      });
    }

    const accountId = resolveAccountId(input.disbursementAccountId);
    const payoff = round2(input.payoffAmount);
    const net = round2(input.principal - payoff);
    const closedAt = now();
    const startingDate = input.startingDate ?? closedAt;

    const contract = input.generateContract
      ? await renderContract(old.customer, {
          principal: input.principal,
          installments: input.termLength,
          installmentAmount: input.paymentAmount,
          frequency: input.paymentFrequency,
          startDate: startingDate,
          maritalStatus: input.maritalStatus,
          occupation: input.occupation
        })
      : undefined;

    const customerName = old.customer.name;

    return client.$transaction(async (tx) => {
      const { count } = await tx.loan.updateMany({
        where: { id: old.id, status: "ACTIVE" },
        data: { status: "RENEWED", closedAt }
      });
      if (count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `El préstamo #${input.loanId} cambió mientras lo renovabas; recarga e intenta de nuevo.`
        });
      }

      const created = await createCreateLoan(tx as unknown as DbClient)({
        customerId: old.customerId,
        principal: input.principal,
        termLength: input.termLength,
        paymentAmount: input.paymentAmount,
        paymentFrequency: input.paymentFrequency,
        startingDate: input.startingDate,
        nickname: input.nickname,
        moraRate: input.moraRate
      });
      const newLoan = (await tx.loan.update({
        where: { id: created.id },
        data: { renewedFromLoanId: old.id }
      })) as unknown as Loan;

      const disbursement = await postTransactionCore(tx as unknown as PrismaClient, {
        type: "WITHDRAWAL",
        accountId,
        amount: net,
        occurredAt: closedAt,
        description: `Renovación préstamo #${old.loanId} → #${newLoan.loanId} para ${customerName} (saldo ${formatDop(payoff)})`,
        reference: `loan-renewal:${newLoan.loanId}`,
        createdById: actor.id
      });

      if (contract) {
        await tx.customerDocument.create({
          data: {
            type: "CONTRACT",
            filename: contract.saved.filename,
            originalName: contract.filename,
            mimeType: "application/pdf",
            size: contract.saved.size,
            sha256: contract.saved.sha256,
            source: "DIRECT",
            customerId: old.customerId,
            loanId: newLoan.id,
            uploadedById: actor.id
          }
        });
      }

      const actorName = await resolveActorName(tx, actor.id);
      await recordEvent(tx, {
        type: "loan.renewed",
        actorId: actor.id,
        actorName,
        customerId: old.customerId,
        customerName,
        loanId: newLoan.id,
        amount: net,
        summary: `${actorName} renovó el préstamo #${old.loanId} → #${newLoan.loanId} de ${customerName} · desembolso ${formatDop(net)}`,
        payload: {
          oldLoanId: old.id,
          newLoanId: newLoan.id,
          oldLoanNumber: old.loanId,
          newLoanNumber: newLoan.loanId,
          principal: input.principal,
          installments: input.termLength,
          frequency: input.paymentFrequency,
          installmentAmount: input.paymentAmount,
          payoff,
          netDisbursed: net,
          transactionId: disbursement.id,
          accountName: disbursement.account.name,
          ...(contract ? { contractFilename: contract.filename } : {})
        }
      });

      logger.verbose("loan renewed", {
        oldLoanId: old.loanId,
        newLoanId: newLoan.loanId,
        payoff,
        net,
        transactionId: disbursement.id
      });

      return {
        oldLoanId: old.loanId,
        newLoan,
        payoff,
        disbursement: {
          transactionId: disbursement.id,
          accountId: disbursement.account.id,
          accountName: disbursement.account.name,
          amount: net
        },
        ...(contract
          ? {
              contract: {
                dataBase64: contract.dataBase64,
                filename: contract.filename,
                mimeType: contract.mimeType
              }
            }
          : {})
      };
    });
  };
}
