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

/**
 * Creates a function to reverse a payment.
 * Sets the payment status to REVERSED and optionally adds a note.
 *
 * @param client - The database client
 * @returns A validated function that reverses a payment
 */
export function createReversePayment(client: DbClient) {
  const fn = async (params: ReversePaymentInput): Promise<Payment> => {
    logger.verbose("reversing payment", { id: params.id });
    const payment = (await client.payment.update({
      where: { id: params.id },
      data: {
        status: "REVERSED",
        notes: params.notes
      }
    })) as unknown as Payment;
    logger.verbose("payment reversed", { id: payment.id });
    return payment;
  };

  return withErrorHandlingAndValidation(fn, reversePaymentSchema);
}
