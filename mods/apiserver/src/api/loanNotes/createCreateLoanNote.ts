/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  createLoanNoteSchema,
  type CreateLoanNoteInput,
  type DbClient,
  type LoanNote
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to add a note to a loan.
 * Looks up the loan by numeric loanId and creates a LoanNote linked to the loan and creator.
 *
 * @param client - The database client
 * @returns A validated function that creates a loan note
 */
export function createCreateLoanNote(client: DbClient) {
  const fn = async (params: CreateLoanNoteInput): Promise<LoanNote> => {
    logger.verbose("creating loan note", { loanId: params.loanId });

    const loan = await client.loan.findUnique({
      where: { loanId: params.loanId },
      select: { id: true }
    });

    if (!loan) {
      throw new Error(`Loan not found with loanId: ${params.loanId}`);
    }

    const creator = await client.user.findUnique({ where: { id: params.createdById } });
    if (!creator) {
      throw new Error(`User not found with id: ${params.createdById}`);
    }

    const created = await client.loanNote.create({
      data: {
        content: params.content,
        loanId: loan.id,
        createdById: params.createdById
      }
    });

    logger.verbose("loan note created", { id: created.id, loanId: params.loanId });

    return {
      id: created.id,
      content: created.content,
      createdAt: created.createdAt,
      loanId: created.loanId,
      createdBy: creator.name
    };
  };

  return withErrorHandlingAndValidation(fn, createLoanNoteSchema);
}
