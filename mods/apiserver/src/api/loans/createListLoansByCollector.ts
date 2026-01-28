/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listLoansByCollectorSchema,
  type ListLoansByCollectorInput,
  type DbClient,
  type Loan
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to list loans for members assigned to a specific collector.
 * By default, only returns ACTIVE loans unless showAll is true.
 *
 * @param client - The database client
 * @returns A validated function that lists loans by collector
 */
export function createListLoansByCollector(client: DbClient) {
  const fn = async (
    params: ListLoansByCollectorInput
  ): Promise<
    (Loan & {
      member: { name: string; phone: string };
    })[]
  > => {
    logger.verbose("listing loans by collector", { collectorId: params.assignedCollectorId });
    const loans = await client.loan.findMany({
      where: {
        member: {
          assignedCollectorId: params.assignedCollectorId
        },
        ...(params.showAll ? {} : { status: "ACTIVE" })
      },
      include: {
        member: {
          select: {
            name: true,
            phone: true
          }
        }
      },
      take: params.limit,
      skip: params.offset
    });
    logger.verbose("loans by collector listed", {
      collectorId: params.assignedCollectorId,
      count: loans.length
    });
    return loans as (Loan & {
      member: { name: string; phone: string };
    })[];
  };

  return withErrorHandlingAndValidation(fn, listLoansByCollectorSchema);
}
