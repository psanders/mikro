/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listPaymentsByMemberSchema,
  type ListPaymentsByMemberInput,
  type DbClient,
  type Payment,
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to list payments for all loans belonging to a specific member.
 * By default, only returns COMPLETED payments unless showReversed is true.
 *
 * @param client - The database client
 * @returns A validated function that lists payments by member
 */
export function createListPaymentsByMember(client: DbClient) {
  const fn = async (params: ListPaymentsByMemberInput): Promise<Payment[]> => {
    logger.verbose("listing payments by member", { memberId: params.memberId });
    const payments = await client.payment.findMany({
      where: {
        loan: {
          memberId: params.memberId,
        },
        paidAt: {
          gte: params.startDate,
          lte: params.endDate,
        },
        ...(params.showReversed ? {} : { status: "COMPLETED" }),
      },
      orderBy: { paidAt: "desc" },
      take: params.limit,
      skip: params.offset,
    }) as unknown as Payment[];
    logger.verbose("payments by member listed", { memberId: params.memberId, count: payments.length });
    return payments;
  };

  return withErrorHandlingAndValidation(fn, listPaymentsByMemberSchema);
}
