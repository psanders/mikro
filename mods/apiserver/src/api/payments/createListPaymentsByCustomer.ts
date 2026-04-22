/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listPaymentsByCustomerSchema,
  type ListPaymentsByCustomerInput,
  type DbClient,
  type Payment
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to list payments for all loans belonging to a specific customer.
 * By default, returns all non-reversed payments unless showReversed is true.
 *
 * @param client - The database client
 * @returns A validated function that lists payments by customer
 */
export function createListPaymentsByCustomer(client: DbClient) {
  const fn = async (
    params: ListPaymentsByCustomerInput
  ): Promise<
    (Payment & {
      loan: {
        loanId: number;
        customer: { name: string };
      };
    })[]
  > => {
    logger.verbose("listing payments by customer", { customerId: params.customerId });
    const payments = await client.payment.findMany({
      where: {
        loan: {
          customerId: params.customerId
        },
        paidAt: {
          gte: params.startDate,
          lte: params.endDate
        },
        ...(params.showReversed ? {} : { status: { not: "REVERSED" } })
      },
      include: {
        loan: {
          select: {
            loanId: true,
            customer: {
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
    logger.verbose("payments by customer listed", {
      customerId: params.customerId,
      count: payments.length
    });
    return payments as (Payment & {
      loan: {
        loanId: number;
        customer: { name: string };
      };
    })[];
  };

  return withErrorHandlingAndValidation(fn, listPaymentsByCustomerSchema);
}
