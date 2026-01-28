/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listPaymentsByLoanIdSchema,
  type ListPaymentsByLoanIdInput,
  type DbClient,
  type Payment
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to list payments for a specific loan by numeric loan ID.
 * Accepts numeric loanId (e.g., 10000, 10001) and converts it to UUID internally.
 * By default, only returns COMPLETED payments unless showReversed is true.
 *
 * @param client - The database client
 * @returns A validated function that lists payments by loan ID
 */
export function createListPaymentsByLoanId(client: DbClient) {
  const fn = async (
    params: ListPaymentsByLoanIdInput
  ): Promise<
    (Payment & {
      loan: {
        loanId: number;
        member: { name: string };
      };
    })[]
  > => {
    logger.verbose("listing payments by loan ID", { loanId: params.loanId });

    // Look up loan by numeric loanId to get the UUID
    const numericLoanId = typeof params.loanId === "string" ? Number(params.loanId) : params.loanId;
    const loan = await client.loan.findUnique({
      where: { loanId: numericLoanId },
      select: { id: true }
    });

    if (!loan) {
      throw new Error(`Loan not found with loanId: ${params.loanId}`);
    }

    const payments = await client.payment.findMany({
      where: {
        loanId: loan.id, // Use UUID from loan lookup
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

    logger.verbose("payments by loan ID listed", {
      loanId: params.loanId,
      loanUuid: loan.id,
      count: payments.length
    });
    return payments as (Payment & {
      loan: {
        loanId: number;
        member: { name: string };
      };
    })[];
  };

  return withErrorHandlingAndValidation(fn, listPaymentsByLoanIdSchema);
}
