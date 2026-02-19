/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  updateLoanNicknameSchema,
  type UpdateLoanNicknameInput,
  type DbClient
} from "@mikro/common";
import { logger } from "../../logger.js";

export interface UpdateLoanNicknameResult {
  id: string;
  loanId: number;
  nickname: string | null;
}

/**
 * Creates a function to update a loan's nickname (set or clear).
 * Resolves the loan by numeric loanId, then updates its nickname.
 *
 * @param client - The database client
 * @returns A validated function that updates a loan's nickname
 */
export function createUpdateLoanNickname(client: DbClient) {
  const fn = async (params: UpdateLoanNicknameInput): Promise<UpdateLoanNicknameResult> => {
    logger.verbose("updating loan nickname", {
      loanId: params.loanId,
      nickname: params.nickname ?? "(clear)"
    });

    const loan = await client.loan.findUnique({
      where: { loanId: params.loanId },
      select: { id: true, loanId: true }
    });

    if (!loan) {
      throw new Error(`Loan not found: ${params.loanId}`);
    }

    const updated = await client.loan.update({
      where: { id: loan.id },
      data: { nickname: params.nickname },
      select: { id: true, loanId: true, nickname: true }
    });

    logger.verbose("loan nickname updated", {
      id: updated.id,
      loanId: updated.loanId,
      nickname: updated.nickname ?? "(clear)"
    });

    return {
      id: updated.id,
      loanId: updated.loanId,
      nickname: updated.nickname ?? null
    };
  };

  return withErrorHandlingAndValidation(fn, updateLoanNicknameSchema);
}
