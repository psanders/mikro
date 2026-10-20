/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared pieces of the renewal process (openspec add-loan-renewal): loading a
 * renewal, what the customer owes on the old loan right now, turning a blocked
 * transition into the right tRPC error, the renewal's public shape, and the
 * event writer every step uses.
 */
import {
  RENEWAL_BLOCK_LABELS_ES,
  evaluateRenewalTransition,
  renewalBlockCode,
  renewalNet,
  roundMoney,
  type DbClient,
  type LoanRenewalStatus,
  type PaymentFrequency,
  type RenewalAction,
  type RenewalActor,
  type RenewalTransitionContext,
  type RenewalTransitionInput,
  type BusinessEventType
} from "@mikro/common";
import { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { formatDop, resolveActorName } from "../events/helpers.js";
import { recordEvent, type EventClient } from "../events/recordEvent.js";
import { buildLoanSnapshotFromDb } from "../loans/buildLoanSnapshotFromDb.js";

/** A renewal row with the relations every step reads. */
export type RenewalRow = Prisma.LoanRenewalGetPayload<{
  include: { loan: true; customer: true };
}>;

/** The renewal as the API and the dashboard see it (numbers, not Decimals). */
export interface LoanRenewalView {
  id: string;
  status: LoanRenewalStatus;
  loan: { id: string; loanId: number; status: string };
  customer: { id: string; name: string };
  terms: {
    principal: number;
    termLength: number;
    paymentAmount: number;
    paymentFrequency: PaymentFrequency;
    startingDate: Date | null;
    nickname: string | null;
    moraRate: number | null;
  };
  /** What the user last saw: owed on the old loan and the resulting net. */
  quoted: { owed: number | null; net: number | null; at: Date | null };
  contractFilename: string | null;
  contractGeneratedAt: Date | null;
  signedContractFilename: string | null;
  newLoanId: string | null;
  ledgerTransactionId: string | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

/** What the customer owes on the old loan now, and the net a given principal leaves. */
export interface OwedNow {
  remainingBalance: number;
  moraAccrued: number;
  /** remainingBalance + moraAccrued, to cents. */
  owed: number;
}

const num = (d: Prisma.Decimal | number | null | undefined): number | null =>
  d == null ? null : Number(d);

export function viewOf(r: RenewalRow): LoanRenewalView {
  return {
    id: r.id,
    status: r.status as LoanRenewalStatus,
    loan: { id: r.loan.id, loanId: r.loan.loanId, status: r.loan.status },
    customer: { id: r.customer.id, name: r.customer.name },
    terms: {
      principal: Number(r.principal),
      termLength: r.termLength,
      paymentAmount: Number(r.paymentAmount),
      paymentFrequency: r.paymentFrequency as PaymentFrequency,
      startingDate: r.startingDate,
      nickname: r.nickname,
      moraRate: num(r.moraRate)
    },
    quoted: { owed: num(r.quotedOwed), net: num(r.quotedNet), at: r.quotedAt },
    contractFilename: r.contractFilename,
    contractGeneratedAt: r.contractGeneratedAt,
    signedContractFilename: r.signedContractFilename,
    newLoanId: r.newLoanId,
    ledgerTransactionId: r.ledgerTransactionId,
    completedAt: r.completedAt,
    cancelledAt: r.cancelledAt,
    cancelReason: r.cancelReason,
    createdById: r.createdById,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  };
}

export async function loadRenewal(
  client: PrismaClient | Prisma.TransactionClient,
  id: string
): Promise<RenewalRow> {
  const r = await client.loanRenewal.findUnique({
    where: { id },
    include: { loan: true, customer: true }
  });
  if (!r) throw new TRPCError({ code: "NOT_FOUND", message: "La renovación no existe." });
  return r;
}

/**
 * The old loan's current remaining balance plus net accrued mora, from the
 * canonical snapshot (the only place mora policy is resolved).
 */
export async function owedNow(client: unknown, loanNumber: number): Promise<OwedNow> {
  const snapshot = await buildLoanSnapshotFromDb(client as DbClient, loanNumber);
  if (!snapshot) {
    throw new TRPCError({ code: "NOT_FOUND", message: `Préstamo #${loanNumber} no existe.` });
  }
  const remainingBalance = roundMoney(snapshot.derived.remainingBalance);
  const moraAccrued = roundMoney(snapshot.derived.moraAccrued);
  return { remainingBalance, moraAccrued, owed: roundMoney(remainingBalance + moraAccrued) };
}

/** The reviewer/admin gate used where no renewal exists yet (start). */
export function assertCanRenew(actor: RenewalActor): void {
  if (!actor.roles.includes("ADMIN") && !actor.roles.includes("REVIEWER")) {
    throw new TRPCError({ code: "FORBIDDEN", message: RENEWAL_BLOCK_LABELS_ES.NOT_ALLOWED });
  }
}

/** Reject a terms set whose principal does not cover what is owed. */
export function assertNetPositive(principal: number, owed: number): number {
  const net = renewalNet(principal, owed);
  if (net <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${RENEWAL_BLOCK_LABELS_ES.NET_NOT_POSITIVE}: el préstamo nuevo (${formatDop(principal)}) debe superar lo que debe hoy (${formatDop(owed)}).`
    });
  }
  return net;
}

/**
 * Decide an action with the shared rules and throw the matching tRPC error when
 * it is blocked. Returns the status the renewal moves to.
 */
export function decide(
  renewal: RenewalRow,
  action: RenewalAction,
  actor: RenewalActor,
  input: RenewalTransitionInput = {},
  ctx: RenewalTransitionContext = {}
): LoanRenewalStatus {
  const result = evaluateRenewalTransition(
    { status: renewal.status as LoanRenewalStatus, contractFilename: renewal.contractFilename },
    action,
    actor,
    input,
    ctx
  );
  if (result.ok) return result.to;
  const money = ctx.owed != null && input.principal != null;
  const extra =
    result.reason === "NET_CHANGED" && money
      ? ` Ahora debe ${formatDop(ctx.owed!)} y se desembolsarían ${formatDop(renewalNet(input.principal!, ctx.owed!))}.`
      : result.reason === "NET_NOT_POSITIVE" && money
        ? ` El préstamo nuevo (${formatDop(input.principal!)}) debe superar lo que debe hoy (${formatDop(ctx.owed!)}).`
        : "";
  throw new TRPCError({
    code: renewalBlockCode(result.reason),
    message: `${RENEWAL_BLOCK_LABELS_ES[result.reason]}.${extra}`,
    cause: { renewalBlock: result.reason }
  });
}

/** Display data every renewal event carries (see `loanRenewalEventBase`). */
export function eventBase(r: RenewalRow) {
  return {
    renewalId: r.id,
    loanId: r.loan.id,
    oldLoanNumber: r.loan.loanId,
    customerId: r.customerId,
    principal: Number(r.principal),
    installments: r.termLength,
    frequency: r.paymentFrequency as PaymentFrequency,
    installmentAmount: Number(r.paymentAmount)
  };
}

/** Append one renewal event inside the caller's transaction. */
export async function emitRenewalEvent(
  tx: EventClient,
  type: Extract<BusinessEventType, `loan.renewal.${string}`>,
  actor: RenewalActor,
  r: RenewalRow,
  what: string,
  extra: Record<string, unknown> = {},
  amount?: number
): Promise<void> {
  const actorName = await resolveActorName(tx, actor.id);
  await recordEvent(tx, {
    type,
    actorId: actor.id,
    actorName,
    customerId: r.customerId,
    customerName: r.customer.name,
    loanId: r.loan.id,
    renewalId: r.id,
    ...(amount != null ? { amount } : {}),
    summary: `${actorName} ${what} del préstamo #${r.loan.loanId} de ${r.customer.name}`,
    payload: { ...eventBase(r), ...extra }
  });
}

/** A unique-constraint failure from Prisma (SQLite surfaces it as P2002). */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}
