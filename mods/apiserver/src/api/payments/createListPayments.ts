/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listPaymentsSchema,
  type ListPaymentsInput,
  type DbClient,
  type Payment
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to list payments within a date range.
 * By default, only returns COMPLETED payments unless showReversed is true.
 *
 * @param client - The database client
 * @returns A validated function that lists payments
 */
export function createListPayments(client: DbClient) {
  const fn = async (
    params: ListPaymentsInput
  ): Promise<
    (Payment & {
      loan: {
        loanId: number;
        member: { name: string };
      };
    })[]
  > => {
    logger.verbose("listing payments", { startDate: params.startDate, endDate: params.endDate });
    const payments = await client.payment.findMany({
      where: {
        paidAt: {
          gte: params.startDate,
          lte: params.endDate
        },
        ...(params.showReversed ? {} : { status: "COMPLETED" })
      },
      include: {
        loan: {
          select: {
            loanId: true,
            member: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: { paidAt: "desc" },
      take: params.limit,
      skip: params.offset
    });
    logger.verbose("payments listed", { count: payments.length });
    return payments as (Payment & {
      loan: {
        loanId: number;
        member: { name: string };
      };
    })[];
  };

  return withErrorHandlingAndValidation(fn, listPaymentsSchema);
}
