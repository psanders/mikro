/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listLoansByMemberSchema,
  type ListLoansByMemberInput,
  type DbClient,
  type Loan
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to list loans for a specific member.
 * By default, only returns ACTIVE loans unless showAll is true.
 *
 * @param client - The database client
 * @returns A validated function that lists loans by member
 */
export function createListLoansByMember(client: DbClient) {
  const fn = async (params: ListLoansByMemberInput): Promise<Loan[]> => {
    logger.verbose("listing loans by member", { memberId: params.memberId });
    const loans = await client.loan.findMany({
      where: {
        memberId: params.memberId,
        ...(params.showAll ? {} : { status: "ACTIVE" })
      },
      take: params.limit,
      skip: params.offset
    });
    logger.verbose("loans by member listed", {
      memberId: params.memberId,
      count: loans.length
    });
    return loans;
  };

  return withErrorHandlingAndValidation(fn, listLoansByMemberSchema);
}
