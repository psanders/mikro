/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  reversePaymentSchema,
  type ReversePaymentInput,
  type DbClient,
  type Payment
} from "@mikro/common";
import { logger } from "../../logger.js";

function mapPayment(p: {
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
  const amount =
    typeof p.amount === "number"
      ? p.amount
      : p.amount && typeof p.amount === "object" && "toString" in p.amount
        ? Number((p.amount as { toString: () => string }).toString())
        : Number(p.amount);
  return {
    id: p.id,
    amount,
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
 * Creates a function to reverse a payment.
 * Sets the payment status to REVERSED and optionally adds a note.
 * When reversing an INSTALLMENT linked to a LATE_FEE (or the LATE_FEE linked to that installment), both rows are reversed in one transaction.
 *
 * @param client - The database client
 * @returns A validated function that reverses a payment
 */
export function createReversePayment(client: DbClient) {
  const fn = async (params: ReversePaymentInput): Promise<Payment> => {
    logger.verbose("reversing payment", { id: params.id });

    const existing = await client.payment.findUnique({
      where: { id: params.id },
      include: { linkedLateFee: true, installmentForLateFee: true }
    });

    if (!existing) {
      throw new Error(`Payment not found: ${params.id}`);
    }

    const idsToReverse = new Set<string>([params.id]);
    if (existing.kind === "INSTALLMENT" && existing.linkedLateFee) {
      idsToReverse.add(existing.linkedLateFee.id);
    }
    if (existing.kind === "LATE_FEE" && existing.installmentForLateFee) {
      idsToReverse.add(existing.installmentForLateFee.id);
    }

    const reversed = await client.$transaction(async (tx) => {
      for (const id of idsToReverse) {
        await tx.payment.update({
          where: { id },
          data: {
            status: "REVERSED",
            notes: id === params.id ? params.notes : undefined
          }
        });
      }
      const row = await tx.payment.findUnique({ where: { id: params.id } });
      if (!row) {
        throw new Error(`Payment not found after reverse: ${params.id}`);
      }
      return row;
    });

    const payment = mapPayment(reversed as Parameters<typeof mapPayment>[0]);
    logger.verbose("payment reversed", { id: payment.id, paired: idsToReverse.size });
    return payment;
  };

  return withErrorHandlingAndValidation(fn, reversePaymentSchema);
}
