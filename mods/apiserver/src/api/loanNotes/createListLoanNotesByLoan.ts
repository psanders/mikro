/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listLoanNotesByLoanSchema,
  type ListLoanNotesByLoanInput,
  type DbClient,
  type LoanNote
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to list all notes for a loan (by numeric loanId).
 *
 * @param client - The database client
 * @returns A validated function that returns notes ordered by createdAt desc
 */
export function createListLoanNotesByLoan(client: DbClient) {
  const fn = async (params: ListLoanNotesByLoanInput): Promise<LoanNote[]> => {
    logger.verbose("listing loan notes", { loanId: params.loanId });

    const loan = await client.loan.findUnique({
      where: { loanId: params.loanId },
      select: { id: true }
    });

    if (!loan) {
      throw new Error(`Loan not found with loanId: ${params.loanId}`);
    }

    const notes = await client.loanNote.findMany({
      where: { loanId: loan.id },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true } } }
    });

    return notes.map((n) => ({
      id: n.id,
      content: n.content,
      createdAt: n.createdAt,
      loanId: n.loanId,
      createdBy: n.createdBy.name
    }));
  };

  return withErrorHandlingAndValidation(fn, listLoanNotesByLoanSchema);
}
