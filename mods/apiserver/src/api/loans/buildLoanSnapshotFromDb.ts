/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Server-side adapter: fetch a loan (with customer + the COMPLETE payment ledger,
 * unfiltered by status) from Prisma and feed it to the shared pure snapshot
 * builder. This is the ONLY place that resolves the mora policy from config; the
 * builder itself stays framework-agnostic so mobile can reuse it over SQLite.
 *
 * `fetchLoanSnapshotInput` is the Prisma-read + raw-mapping half, split out so
 * other callers (the loan-statement report builder) can get the DB-free
 * `BuildSnapshotInput` shape without a second, divergent Prisma query — they
 * hand it to their own `buildLoanSnapshot`-consuming pipeline instead of the
 * already-derived `LoanSnapshot`. `buildLoanSnapshotFromDb` stays a thin
 * wrapper over it for existing callers.
 */
import {
  buildLoanSnapshot,
  amountToNumber,
  getConfig,
  type BuildSnapshotInput,
  type DbClient,
  type LoanSnapshot,
  type SnapshotPayment,
  type PaymentKind,
  type PaymentStatus,
  type LoanStatus
} from "@mikro/common";

type LoanRow = {
  loanId: number;
  principal: unknown;
  paymentAmount: unknown;
  termLength: number;
  paymentFrequency: string;
  status: LoanStatus;
  moraRate: unknown;
  createdAt: Date;
  startingDate: Date | null;
  updatedAt: Date;
  nickname: string | null;
  customer: {
    id: string;
    name: string;
    nickname: string | null;
    preferredPaymentDay: string | null;
  };
  payments: Array<{
    id: string;
    kind: string;
    status: string;
    amount: unknown;
    paidAt: Date;
    method: string | null;
    collectedById: string | null;
    linkedPaymentId: string | null;
    notes: string | null;
    collectedBy: { name: string } | null;
  }>;
};

/**
 * Fetch a loan (+ customer + the complete payment ledger) from Prisma and map
 * it into the DB-free `BuildSnapshotInput` shape — no derived numbers yet.
 * Returns null if the loan does not exist. This is the ONLY place that
 * resolves the mora policy from config; everything downstream is pure.
 */
export async function fetchLoanSnapshotInput(
  client: DbClient,
  loanId: number,
  asOf?: Date
): Promise<BuildSnapshotInput | null> {
  const loan = (await client.loan.findUnique({
    where: { loanId },
    include: {
      customer: {
        select: { id: true, name: true, nickname: true, preferredPaymentDay: true }
      },
      payments: {
        // ALL statuses — the ledger is raw truth; the derived section decides what counts.
        include: { collectedBy: { select: { name: true } } }
      }
    }
  })) as LoanRow | null;

  if (!loan) return null;

  const cfg = getConfig();
  const moraRate =
    loan.moraRate != null ? amountToNumber(loan.moraRate) : cfg.loans.defaultMoraRate;

  const payments: SnapshotPayment[] = loan.payments.map((p) => ({
    id: p.id,
    kind: p.kind as PaymentKind,
    status: p.status as PaymentStatus,
    amount: amountToNumber(p.amount),
    paidAt: new Date(p.paidAt),
    method: p.method,
    collectedById: p.collectedById,
    collectedByName: p.collectedBy?.name ?? null,
    linkedPaymentId: p.linkedPaymentId,
    notes: p.notes
  }));

  return {
    loanId: loan.loanId,
    customer: {
      id: loan.customer.id,
      name: loan.customer.name,
      nickname: loan.customer.nickname,
      preferredPaymentDay: loan.customer.preferredPaymentDay
    },
    loan: {
      principal: amountToNumber(loan.principal),
      paymentAmount: amountToNumber(loan.paymentAmount),
      termLength: loan.termLength,
      paymentFrequency: loan.paymentFrequency,
      status: loan.status,
      createdAt: new Date(loan.createdAt),
      startingDate: loan.startingDate != null ? new Date(loan.startingDate) : null,
      updatedAt: new Date(loan.updatedAt),
      nickname: loan.nickname
    },
    payments,
    policy: {
      moraRate,
      moraGraceDays: cfg.loans.moraGraceDays,
      moraCapInCuotas: cfg.loans.moraCapInCuotas,
      moraMinDop: cfg.loans.moraMinDop,
      moraStopOnDefault: cfg.loans.moraStopOnDefault,
      moraEffectiveFrom: cfg.loans.moraEffectiveFrom ?? null
    },
    asOf
  };
}

/** Build a canonical snapshot for one loan from the database. Returns null if not found. */
export async function buildLoanSnapshotFromDb(
  client: DbClient,
  loanId: number,
  asOf?: Date
): Promise<LoanSnapshot | null> {
  const input = await fetchLoanSnapshotInput(client, loanId, asOf);
  return input ? buildLoanSnapshot(input) : null;
}
