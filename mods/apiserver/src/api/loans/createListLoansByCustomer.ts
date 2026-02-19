/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listLoansByCustomerSchema,
  type ListLoansByCustomerInput,
  type DbClient,
  type Loan
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to list loans for a specific customer.
 * By default, only returns ACTIVE loans unless showAll is true.
 *
 * @param client - The database client
 * @returns A validated function that lists loans by customer
 */
export function createListLoansByCustomer(client: DbClient) {
  const fn = async (params: ListLoansByCustomerInput): Promise<Loan[]> => {
    logger.verbose("listing loans by customer", { customerId: params.customerId });
    const loans = await client.loan.findMany({
      where: {
        customerId: params.customerId,
        ...(params.showAll ? {} : { status: "ACTIVE" })
      },
      take: params.limit,
      skip: params.offset
    });
    logger.verbose("loans by customer listed", {
      customerId: params.customerId,
      count: loans.length
    });
    return loans;
  };

  return withErrorHandlingAndValidation(fn, listLoansByCustomerSchema);
}
