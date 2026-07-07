/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Portfolio-wide health check: builds a snapshot for every loan and runs the
 * deterministic check registry over all of them, returning an aggregate report
 * (pass/fail counts, per-check failure tally, worst offenders). No LLM — cheap,
 * exhaustive, safe to run on a schedule or in CI.
 */
import {
  withErrorHandlingAndValidation,
  portfolioHealthSchema,
  runPortfolioHealthCheck as aggregate,
  type PortfolioHealthInput,
  type DbClient,
  type LoanSnapshot,
  type PortfolioHealthReport
} from "@mikro/common";
import { logger } from "../../logger.js";
import { buildLoanSnapshotFromDb } from "../loans/buildLoanSnapshotFromDb.js";

export function createRunPortfolioHealthCheck(client: DbClient) {
  const fn = async (params: PortfolioHealthInput): Promise<PortfolioHealthReport> => {
    const where = params.includeAllStatuses ? {} : { status: "ACTIVE" as const };
    const loans = (await client.loan.findMany({ where, select: { loanId: true } })) as Array<{
      loanId: number;
    }>;

    logger.verbose("running portfolio health check", {
      loans: loans.length,
      includeAllStatuses: params.includeAllStatuses
    });

    const snapshots: LoanSnapshot[] = [];
    for (const { loanId } of loans) {
      const snapshot = await buildLoanSnapshotFromDb(client, loanId);
      if (snapshot) snapshots.push(snapshot);
    }

    const report = aggregate(snapshots);
    logger.verbose("portfolio health check ready", {
      loansChecked: report.loansChecked,
      loansFailing: report.loansFailing
    });
    return report;
  };

  return withErrorHandlingAndValidation(fn, portfolioHealthSchema);
}
