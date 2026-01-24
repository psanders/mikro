/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listLoansByReferrerSchema,
  type ListLoansByReferrerInput,
  type DbClient,
  type Loan,
} from "@mikro/common";

/**
 * Creates a function to list loans for members referred by a specific user.
 * By default, only returns ACTIVE loans unless showAll is true.
 *
 * @param client - The database client
 * @returns A validated function that lists loans by referrer
 */
export function createListLoansByReferrer(client: DbClient) {
  const fn = async (params: ListLoansByReferrerInput): Promise<Loan[]> => {
    return client.loan.findMany({
      where: {
        member: {
          referredById: params.referredById,
        },
        ...(params.showAll ? {} : { status: "ACTIVE" }),
      },
      take: params.limit,
      skip: params.offset,
    });
  };

  return withErrorHandlingAndValidation(fn, listLoansByReferrerSchema);
}
