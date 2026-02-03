/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  updateLoanStatusSchema,
  type UpdateLoanStatusInput,
  type DbClient
} from "@mikro/common";
import { logger } from "../../logger.js";

export interface UpdateLoanStatusResult {
  id: string;
  loanId: number;
  status: string;
}

/**
 * Creates a function to update a loan's status (COMPLETED, DEFAULTED, or CANCELLED).
 * Resolves the loan by numeric loanId, then updates its status.
 *
 * @param client - The database client
 * @returns A validated function that updates a loan's status
 */
export function createUpdateLoanStatus(client: DbClient) {
  const fn = async (params: UpdateLoanStatusInput): Promise<UpdateLoanStatusResult> => {
    logger.verbose("updating loan status", { loanId: params.loanId, status: params.status });

    const loan = await client.loan.findUnique({
      where: { loanId: params.loanId },
      select: { id: true, loanId: true }
    });

    if (!loan) {
      throw new Error(`Loan not found: ${params.loanId}`);
    }

    const updated = await client.loan.update({
      where: { id: loan.id },
      data: { status: params.status },
      select: { id: true, loanId: true, status: true }
    });

    logger.verbose("loan status updated", {
      id: updated.id,
      loanId: updated.loanId,
      status: updated.status
    });

    return {
      id: updated.id,
      loanId: updated.loanId,
      status: updated.status
    };
  };

  return withErrorHandlingAndValidation(fn, updateLoanStatusSchema);
}
