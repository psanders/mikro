/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Single-loan health check: builds the snapshot, runs the deterministic check
 * registry, and (when `explain` is set and a model factory is wired) adds an LLM
 * narration of how the numbers were reached. The numbers always come from the
 * eval engine; the model only narrates.
 */
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  withErrorHandlingAndValidation,
  loanHealthSchema,
  evaluateSnapshot,
  type LoanHealthInput,
  type DbClient,
  type LoanSnapshot,
  type EvalReport
} from "@mikro/common";
import { logger } from "../../logger.js";
import { buildLoanSnapshotFromDb } from "./buildLoanSnapshotFromDb.js";
import { explainLoanHealth } from "./explainLoanHealth.js";

export interface LoanHealthResult {
  snapshot: LoanSnapshot;
  report: EvalReport;
  /** Spanish narration when requested and available; otherwise null. */
  narration: string | null;
}

export interface GetLoanHealthOptions {
  /** Injected LLM factory for the `explain` narration. Absent → narration is null. */
  createModel?: () => BaseChatModel;
}

export function createGetLoanHealth(client: DbClient, options: GetLoanHealthOptions = {}) {
  const fn = async (params: LoanHealthInput): Promise<LoanHealthResult> => {
    logger.verbose("running loan health check", { loanId: params.loanId, explain: params.explain });
    const snapshot = await buildLoanSnapshotFromDb(client, params.loanId);
    if (!snapshot) {
      throw new Error(`Loan not found with loanId: ${params.loanId}`);
    }

    const report = evaluateSnapshot(snapshot);

    let narration: string | null = null;
    if (params.explain && options.createModel) {
      try {
        narration = await explainLoanHealth(options.createModel(), snapshot, report);
      } catch (err) {
        logger.warn("loan health narration failed", { loanId: params.loanId, err });
      }
    }

    return { snapshot, report, narration };
  };

  return withErrorHandlingAndValidation(fn, loanHealthSchema);
}
