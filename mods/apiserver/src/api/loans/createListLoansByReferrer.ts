/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listLoansByReferrerSchema,
  type ListLoansByReferrerInput,
  type DbClient,
  type Loan
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to list loans for members referred by a specific user.
 * By default, only returns ACTIVE loans unless showAll is true.
 *
 * @param client - The database client
 * @returns A validated function that lists loans by referrer
 */
export function createListLoansByReferrer(client: DbClient) {
  const fn = async (params: ListLoansByReferrerInput): Promise<Loan[]> => {
    logger.verbose("listing loans by referrer", { referrerId: params.referredById });
    const loans = await client.loan.findMany({
      where: {
        member: {
          referredById: params.referredById
        },
        ...(params.showAll ? {} : { status: "ACTIVE" })
      },
      take: params.limit,
      skip: params.offset
    });
    logger.verbose("loans by referrer listed", {
      referrerId: params.referredById,
      count: loans.length
    });
    return loans;
  };

  return withErrorHandlingAndValidation(fn, listLoansByReferrerSchema);
}
