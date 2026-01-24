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
import { logger } from "../../logger.js";

/**
 * Creates a function to record a new payment for a loan.
 * Default payment method is CASH.
 *
 * @param client - The database client
 * @returns A validated function that creates a payment
 */
export function createCreatePayment(client: DbClient) {
  const fn = async (params: CreatePaymentInput): Promise<Payment> => {
    logger.verbose("creating payment", { loanId: params.loanId, amount: params.amount.toString() });
    const payment = await client.payment.create({
      data: {
        loanId: params.loanId,
        amount: params.amount,
        paidAt: params.paidAt,
        method: params.method ?? "CASH",
        collectedById: params.collectedById,
        notes: params.notes,
      },
    }) as unknown as Payment;
    logger.verbose("payment created", { id: payment.id, loanId: params.loanId });
    return payment;
  };

  return withErrorHandlingAndValidation(fn, createPaymentSchema);
}
