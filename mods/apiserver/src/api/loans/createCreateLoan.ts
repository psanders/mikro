/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  createLoanSchema,
  type CreateLoanInput,
  type DbClient,
  type Loan
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to create a new loan.
 * Generates a unique loanId (sequential integer starting at 10000).
 *
 * @param client - The database client
 * @returns A validated function that creates a loan
 */
export function createCreateLoan(client: DbClient) {
  const fn = async (params: CreateLoanInput): Promise<Loan> => {
    logger.verbose("creating loan", {
      memberId: params.memberId,
      principal: params.principal.toString()
    });

    // Get the next loan ID (start at 10000 if no loans exist)
    const lastLoan = await client.loan.findFirst({
      orderBy: { loanId: "desc" },
      select: { loanId: true }
    });
    const nextLoanId = lastLoan ? lastLoan.loanId + 1 : 10000;

    const loan = (await client.loan.create({
      data: {
        loanId: nextLoanId,
        memberId: params.memberId,
        principal: params.principal,
        termLength: params.termLength,
        paymentAmount: params.paymentAmount,
        paymentFrequency: params.paymentFrequency,
        type: params.type ?? "SAN"
      }
    })) as unknown as Loan;

    logger.verbose("loan created", { id: loan.id, loanId: nextLoanId, memberId: params.memberId });
    return loan;
  };

  return withErrorHandlingAndValidation(fn, createLoanSchema);
}
