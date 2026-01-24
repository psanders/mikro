/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listLoansSchema,
  type ListLoansInput,
  type DbClient,
  type Loan,
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to list all loans with optional pagination.
 * By default, only returns ACTIVE loans unless showAll is true.
 *
 * @param client - The database client
 * @returns A validated function that lists loans
 */
export function createListLoans(client: DbClient) {
  const fn = async (params: ListLoansInput): Promise<Loan[]> => {
    logger.verbose("listing loans", { limit: params.limit, offset: params.offset, showAll: params.showAll });
    const loans = await client.loan.findMany({
      where: params.showAll ? undefined : { status: "ACTIVE" },
      take: params.limit,
      skip: params.offset,
    });
    logger.verbose("loans listed", { count: loans.length });
    return loans;
  };

  return withErrorHandlingAndValidation(fn, listLoansSchema);
}
