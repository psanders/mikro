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

/**
 * Creates a function to list payments for all loans belonging to a specific member.
 * By default, only returns COMPLETED payments unless showReversed is true.
 *
 * @param client - The database client
 * @returns A validated function that lists payments by member
 */
export function createListPaymentsByMember(client: DbClient) {
  const fn = async (params: ListPaymentsByMemberInput): Promise<Payment[]> => {
    return client.payment.findMany({
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
  };

  return withErrorHandlingAndValidation(fn, listPaymentsByMemberSchema);
}
