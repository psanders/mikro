/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listPaymentsByReferrerSchema,
  type ListPaymentsByReferrerInput,
  type DbClient,
  type Payment
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to list payments for all loans belonging to members
 * referred by a specific user.
 * By default, only returns COMPLETED payments unless showReversed is true.
 *
 * @param client - The database client
 * @returns A validated function that lists payments by referrer
 */
export function createListPaymentsByReferrer(client: DbClient) {
  const fn = async (
    params: ListPaymentsByReferrerInput
  ): Promise<
    (Payment & {
      loan: {
        loanId: number;
        member: { name: string };
      };
    })[]
  > => {
    logger.verbose("listing payments by referrer", { referrerId: params.referredById });
    const payments = await client.payment.findMany({
      where: {
        loan: {
          member: {
            referredById: params.referredById
          }
        },
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
    logger.verbose("payments by referrer listed", {
      referrerId: params.referredById,
      count: payments.length
    });
    return payments as (Payment & {
      loan: {
        loanId: number;
        member: { name: string };
      };
    })[];
  };

  return withErrorHandlingAndValidation(fn, listPaymentsByReferrerSchema);
}
