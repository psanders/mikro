/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  createPaymentSchema,
  type CreatePaymentInput,
  type DbClient,
  type Payment,
  type Loan,
  getConfig,
  type ResolvedMikroConfig,
  computeAccruedMora,
  amountToNumber,
  toLoanPaymentData
} from "@mikro/common";
import { logger } from "../../logger.js";

type LoanMoraContext = Loan & {
  customer: { preferredPaymentDay: string | null };
  payments: Array<{ paidAt: Date; status: string; kind: string }>;
};

export interface CreatePaymentResult {
  installment: Payment | null;
  lateFee: Payment | null;
}

export interface CreateCreatePaymentOptions {
  onPaymentCreated?: (paymentId: string) => void;
  getConfigFn?: () => ResolvedMikroConfig;
}

function mapPaymentRow(p: {
  id: string;
  amount: unknown;
  paidAt: Date;
  method: string;
  status: string;
  kind: string;
  linkedPaymentId: string | null;
  notes: string | null;
  loanId: string;
  collectedById: string;
  createdAt: Date;
  updatedAt: Date;
}): Payment {
  return {
    id: p.id,
    amount: amountToNumber(p.amount),
    paidAt: p.paidAt,
    method: p.method as Payment["method"],
    status: p.status as Payment["status"],
    kind: p.kind as Payment["kind"],
    linkedPaymentId: p.linkedPaymentId,
    notes: p.notes,
    loanId: p.loanId,
    collectedById: p.collectedById,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  };
}

/**
 * Creates a function to record a new payment for a loan.
 * Accepts numeric loanId (e.g., 10000, 10001) and converts it to UUID internally.
 * Default payment method is CASH.
 * By default splits mora-first into LATE_FEE + INSTALLMENT Prisma rows unless `kind` forces a single row.
 *
 * @param client - The database client
 * @param options - Optional callback when a payment is created (e.g. send WhatsApp confirmation)
 * @returns A validated function that creates payment(s)
 */
export function createCreatePayment(client: DbClient, options?: CreateCreatePaymentOptions) {
  const { onPaymentCreated, getConfigFn } = options ?? {};
  const resolveConfig = getConfigFn ?? getConfig;
  const fn = async (params: CreatePaymentInput): Promise<CreatePaymentResult> => {
    logger.verbose("creating payment", { loanId: params.loanId, amount: params.amount.toString() });

    const loan = (await client.loan.findUnique({
      where: { loanId: params.loanId },
      include: {
        customer: { select: { preferredPaymentDay: true } },
        payments: {
          where: { status: { in: ["COMPLETED", "PARTIAL", "PENDING"] } },
          select: { paidAt: true, status: true, kind: true }
        }
      }
    })) as LoanMoraContext | null;

    if (!loan) {
      throw new Error(`Loan not found with loanId: ${params.loanId}`);
    }

    const expected = amountToNumber(loan.paymentAmount);
    const amountNum = Number(params.amount);
    const cfg = resolveConfig();
    const moraRate =
      loan.moraRate != null ? amountToNumber(loan.moraRate) : cfg.loans.defaultMoraRate;
    const loanStart = new Date(loan.startingDate ?? loan.createdAt);
    const paidAt = params.paidAt ?? new Date();

    const duplicateGuardNeeded = (installmentPortion: number) => {
      if (installmentPortion <= 0) return null;
      const recentPaymentCutoff = new Date(Date.now() - 10 * 60 * 1000);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return { recentPaymentCutoff, oneHourAgo };
    };

    const runDuplicateGuard = async (installmentPortion: number) => {
      const g = duplicateGuardNeeded(installmentPortion);
      if (!g) return;
      const recentPayments = await client.payment.findMany({
        where: {
          loanId: loan.id,
          kind: "INSTALLMENT",
          status: { in: ["COMPLETED", "PARTIAL"] },
          paidAt: { gte: g.oneHourAgo }
        },
        orderBy: { paidAt: "desc" },
        take: 5
      });
      const recentPayment = recentPayments.find((p) => p.createdAt >= g.recentPaymentCutoff);
      if (recentPayment) {
        throw new Error(
          `Duplicate payment blocked: A payment was already recorded for loan ${params.loanId} ` +
            `at ${recentPayment.createdAt.toISOString()}. Wait at least 10 minutes between payments.`
        );
      }
    };

    const loanData = toLoanPaymentData(loan);
    const accrued = computeAccruedMora({
      loanData,
      moraRate,
      paymentAmount: expected,
      paymentFrequency: loan.paymentFrequency,
      preferredPaymentDay: loan.customer.preferredPaymentDay ?? null,
      loanStart,
      asOfDate: paidAt,
      loanStatus: loan.status,
      loanUpdatedAt: new Date(loan.updatedAt),
      policy: cfg.loans
    });

    let lateFeePortion = 0;
    let installmentPortion = amountNum;

    if (params.kind === "LATE_FEE") {
      lateFeePortion = amountNum;
      installmentPortion = 0;
    } else if (params.kind === "INSTALLMENT") {
      lateFeePortion = 0;
      installmentPortion = amountNum;
    } else {
      const override = params.lateFeeOverride ?? 0;
      const suggestedMora = Math.max(0, accrued.moraAmount - override);
      lateFeePortion = Math.min(amountNum, suggestedMora);
      installmentPortion = amountNum - lateFeePortion;
    }

    await runDuplicateGuard(installmentPortion);

    const method = params.method ?? "CASH";
    const notes = params.notes ?? null;

    const result = await client.$transaction(async (tx) => {
      let lateFeeRow: Payment | null = null;
      let installmentRow: Payment | null = null;

      if (lateFeePortion > 0) {
        const created = await tx.payment.create({
          data: {
            loanId: loan.id,
            amount: lateFeePortion,
            paidAt,
            method,
            status: "COMPLETED",
            kind: "LATE_FEE",
            collectedById: params.collectedById,
            notes
          }
        });
        lateFeeRow = mapPaymentRow(created);
      }

      if (installmentPortion > 0) {
        const resolvedStatus =
          params.status ??
          (installmentPortion + 1e-9 < expected ? ("PARTIAL" as const) : ("COMPLETED" as const));
        const created = await tx.payment.create({
          data: {
            loanId: loan.id,
            amount: installmentPortion,
            paidAt,
            method,
            status: resolvedStatus,
            kind: "INSTALLMENT",
            linkedPaymentId: lateFeeRow?.id ?? null,
            collectedById: params.collectedById,
            notes
          }
        });
        installmentRow = mapPaymentRow(created);
      }

      return { installment: installmentRow, lateFee: lateFeeRow };
    });

    logger.verbose("payment(s) created", {
      loanId: params.loanId,
      installmentId: result.installment?.id,
      lateFeeId: result.lateFee?.id
    });

    if (onPaymentCreated) {
      const primaryId = result.installment?.id ?? result.lateFee?.id;
      if (primaryId) {
        setImmediate(() => onPaymentCreated(primaryId));
      }
    }

    return result;
  };

  return withErrorHandlingAndValidation(fn, createPaymentSchema);
}
