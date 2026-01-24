/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  createPaymentSchema,
  type CreatePaymentInput,
  type DbClient,
  type Payment,
} from "@mikro/common";

/**
 * Creates a function to record a new payment for a loan.
 * Default payment method is CASH.
 *
 * @param client - The database client
 * @returns A validated function that creates a payment
 */
export function createCreatePayment(client: DbClient) {
  const fn = async (params: CreatePaymentInput): Promise<Payment> => {
    return client.payment.create({
      data: {
        loanId: params.loanId,
        amount: params.amount,
        paidAt: params.paidAt,
        method: params.method ?? "CASH",
        collectedById: params.collectedById,
        notes: params.notes,
      },
    }) as unknown as Payment;
  };

  return withErrorHandlingAndValidation(fn, createPaymentSchema);
}
