/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Runs the collections check registry over a snapshot (single loan) or many
 * (portfolio). Deterministic — no LLM. The single-loan explainer and the copilot
 * summaries consume these results; the LLM never recomputes the numbers.
 */
import { COLLECTIONS_CHECKS, type CheckResult } from "./checks.js";
import type { LoanSnapshot } from "./snapshot.js";

export interface EvalReport {
  loanId: number;
  pass: boolean;
  passCount: number;
  failCount: number;
  results: CheckResult[];
  /** Ids of failed critical checks, for quick triage. */
  criticalFailures: string[];
}

/** Run every check over one snapshot. */
export function evaluateSnapshot(s: LoanSnapshot): EvalReport {
  const results: CheckResult[] = COLLECTIONS_CHECKS.map((c) => {
    const r = c.run(s);
    return {
      id: c.id,
      title: c.title,
      severity: c.severity,
      class: c.class,
      ...r
    };
  });
  const failures = results.filter((r) => !r.pass);
  return {
    loanId: s.loanId,
    pass: failures.length === 0,
    passCount: results.length - failures.length,
    failCount: failures.length,
    results,
    criticalFailures: failures.filter((r) => r.severity === "critical").map((r) => r.id)
  };
}

export interface PortfolioHealthReport {
  loansChecked: number;
  loansPassing: number;
  loansFailing: number;
  /** Per-check failure tally across the portfolio, worst first. */
  failuresByCheck: Array<{ id: string; title: string; severity: string; count: number }>;
  /** Loans with at least one failure, worst (most/critical failures) first. */
  offenders: Array<{
    loanId: number;
    customerName: string;
    failCount: number;
    criticalFailures: string[];
  }>;
}

/** Aggregate check results across many snapshots into a portfolio health report. */
export function runPortfolioHealthCheck(snapshots: LoanSnapshot[]): PortfolioHealthReport {
  const reports = snapshots.map((s) => ({ snapshot: s, report: evaluateSnapshot(s) }));
  const failing = reports.filter((r) => !r.report.pass);

  const byCheck = new Map<string, { id: string; title: string; severity: string; count: number }>();
  for (const { report } of reports) {
    for (const r of report.results) {
      if (r.pass) continue;
      const entry = byCheck.get(r.id) ?? {
        id: r.id,
        title: r.title,
        severity: r.severity,
        count: 0
      };
      entry.count++;
      byCheck.set(r.id, entry);
    }
  }

  const offenders = failing
    .map(({ snapshot, report }) => ({
      loanId: snapshot.loanId,
      customerName: snapshot.customer.nickname ?? snapshot.customer.name,
      failCount: report.failCount,
      criticalFailures: report.criticalFailures
    }))
    .sort(
      (a, b) => b.criticalFailures.length - a.criticalFailures.length || b.failCount - a.failCount
    );

  return {
    loansChecked: reports.length,
    loansPassing: reports.length - failing.length,
    loansFailing: failing.length,
    failuresByCheck: [...byCheck.values()].sort((a, b) => b.count - a.count),
    offenders
  };
}
