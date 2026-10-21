/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  ValidationError,
  startLoanRenewalSchema,
  type RenewalActor,
  type StartLoanRenewalInput
} from "@mikro/common";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { logger } from "../../logger.js";
import {
  assertCanRenew,
  assertNetPositive,
  emitRenewalEvent,
  isUniqueViolation,
  loadRenewal,
  owedNow,
  viewOf,
  type LoanRenewalView
} from "./support.js";

/**
 * Start a renewal on an ACTIVE loan. Writes only the renewal (DRAFT): nothing
 * about the old loan, a new loan or the ledger changes until finalize. Terms
 * left out default to the old loan's own. One open renewal per loan: the unique
 * `open_key` backs up the check, so two racing starts cannot both win.
 */
export function createStartLoanRenewal(client: PrismaClient, deps: { now?: () => Date } = {}) {
  const now = deps.now ?? (() => new Date());

  return async (raw: StartLoanRenewalInput, actor: RenewalActor): Promise<LoanRenewalView> => {
    const parsed = startLoanRenewalSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(parsed.error);
    const input = parsed.data;
    assertCanRenew(actor);

    const old = await client.loan.findUnique({ where: { loanId: input.loanId } });
    if (!old) {
      throw new TRPCError({ code: "NOT_FOUND", message: `Préstamo #${input.loanId} no existe.` });
    }
    if (old.status !== "ACTIVE") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Solo se puede renovar un préstamo activo (#${input.loanId} está ${old.status}).`
      });
    }
    const open = await client.loanRenewal.findFirst({
      where: { loanId: old.id, openKey: { not: null } },
      select: { id: true }
    });
    if (open) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `El préstamo #${input.loanId} ya tiene una renovación abierta.`,
        cause: { renewalId: open.id }
      });
    }

    const { owed } = await owedNow(client, old.loanId);
    const t = input.terms ?? {};
    const principal = t.principal ?? Number(old.principal);
    const net = assertNetPositive(principal, owed);
    const at = now();

    try {
      const created = await client.$transaction(async (tx) => {
        const r = await tx.loanRenewal.create({
          data: {
            status: "DRAFT",
            loanId: old.id,
            customerId: old.customerId,
            principal,
            termLength: t.termLength ?? old.termLength,
            paymentAmount: t.paymentAmount ?? Number(old.paymentAmount),
            paymentFrequency: t.paymentFrequency ?? old.paymentFrequency,
            startingDate: t.startingDate ?? null,
            nickname: t.nickname ?? old.nickname,
            moraRate: t.moraRate ?? (old.moraRate == null ? null : Number(old.moraRate)),
            quotedOwed: owed,
            quotedNet: net,
            quotedAt: at,
            openKey: old.id,
            createdById: actor.id
          },
          select: { id: true }
        });
        const full = await loadRenewal(tx, r.id);
        await emitRenewalEvent(tx, "loan.renewal.started", actor, full, "inició la renovación", {
          owed,
          net
        });
        return full;
      });
      logger.verbose("loan renewal started", {
        renewalId: created.id,
        loanId: old.loanId,
        owed,
        net
      });
      return viewOf(created);
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `El préstamo #${input.loanId} ya tiene una renovación abierta.`
        });
      }
      throw e;
    }
  };
}
