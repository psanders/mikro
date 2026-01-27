/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  createPaymentSchema,
  type CreatePaymentInput,
  type DbClient,
  type Payment
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to record a new payment for a loan.
 * Accepts numeric loanId (e.g., 10000, 10001) and converts it to UUID internally.
 * Default payment method is CASH.
 *
 * @param client - The database client
 * @returns A validated function that creates a payment
 */
export function createCreatePayment(client: DbClient) {
  const fn = async (params: CreatePaymentInput): Promise<Payment> => {
    logger.verbose("creating payment", { loanId: params.loanId, amount: params.amount.toString() });

    // Look up loan by numeric loanId to get the UUID
    // params.loanId is validated as a number by the schema
    const numericLoanId = typeof params.loanId === "string" ? Number(params.loanId) : params.loanId;
    const loan = await client.loan.findUnique({
      where: { loanId: numericLoanId },
      select: { id: true }
    });

    if (!loan) {
      throw new Error(`Loan not found with loanId: ${params.loanId}`);
    }

    // Check for recent payments on this loan (duplicate guard)
    const recentPaymentCutoff = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago for query optimization
    const recentPayments = await client.payment.findMany({
      where: {
        loanId: loan.id,
        status: "COMPLETED",
        paidAt: { gte: oneHourAgo } // Limit query scope to last hour
      },
      orderBy: { paidAt: "desc" },
      take: 5 // Only need to check a few recent payments
    });

    const recentPayment = recentPayments.find((p) => p.createdAt >= recentPaymentCutoff);

    if (recentPayment) {
      throw new Error(
        `Duplicate payment blocked: A payment was already recorded for loan ${params.loanId} ` +
          `at ${recentPayment.createdAt.toISOString()}. Wait at least 10 minutes between payments.`
      );
    }

    const payment = (await client.payment.create({
      data: {
        loanId: loan.id, // Use UUID from loan lookup
        amount: params.amount,
        paidAt: params.paidAt,
        method: params.method ?? "CASH",
        collectedById: params.collectedById,
        notes: params.notes
      }
    })) as unknown as Payment;
    logger.verbose("payment created", { id: payment.id, loanId: params.loanId, loanUuid: loan.id });
    return payment;
  };

  return withErrorHandlingAndValidation(fn, createPaymentSchema);
}
