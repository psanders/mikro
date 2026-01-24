/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listLoansByCollectorSchema,
  type ListLoansByCollectorInput,
  type DbClient,
  type Loan,
} from "@mikro/common";

/**
 * Creates a function to list loans for members assigned to a specific collector.
 * By default, only returns ACTIVE loans unless showAll is true.
 *
 * @param client - The database client
 * @returns A validated function that lists loans by collector
 */
export function createListLoansByCollector(client: DbClient) {
  const fn = async (params: ListLoansByCollectorInput): Promise<Loan[]> => {
    return client.loan.findMany({
      where: {
        member: {
          assignedCollectorId: params.assignedCollectorId,
        },
        ...(params.showAll ? {} : { status: "ACTIVE" }),
      },
      take: params.limit,
      skip: params.offset,
    });
  };

  return withErrorHandlingAndValidation(fn, listLoansByCollectorSchema);
}
