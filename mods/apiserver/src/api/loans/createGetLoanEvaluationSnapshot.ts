/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Returns the canonical loan snapshot — one JSON with the loan terms, the full
 * raw payment ledger (every status), and the collector-facing derived numbers.
 * The single substrate for the evaluation framework and the founder copilot.
 */
import {
  withErrorHandlingAndValidation,
  getLoanByLoanIdSchema,
  type GetLoanByLoanIdInput,
  type DbClient,
  type LoanSnapshot
} from "@mikro/common";
import { logger } from "../../logger.js";
import { buildLoanSnapshotFromDb } from "./buildLoanSnapshotFromDb.js";

export function createGetLoanEvaluationSnapshot(client: DbClient) {
  const fn = async (params: GetLoanByLoanIdInput): Promise<LoanSnapshot> => {
    logger.verbose("building loan evaluation snapshot", { loanId: params.loanId });
    const snapshot = await buildLoanSnapshotFromDb(client, params.loanId);
    if (!snapshot) {
      throw new Error(`Loan not found with loanId: ${params.loanId}`);
    }
    return snapshot;
  };

  return withErrorHandlingAndValidation(fn, getLoanByLoanIdSchema);
}
