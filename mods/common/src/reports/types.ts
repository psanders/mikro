/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Types for performance report: portfolio metrics and LLM narrative.
 */

/** Loan counts and principal by status. */
export interface LoansByStatus {
  ACTIVE: { count: number; principalDop: number };
  COMPLETED: { count: number; principalDop: number };
  DEFAULTED: { count: number; principalDop: number };
  CANCELLED: { count: number; principalDop: number };
}

/** Breakdown by loan size (standard 5000, larger 10000, exception). */
export interface LoansBySize {
  standard: { count: number; principalDop: number };
  larger: { count: number; principalDop: number };
  exception: { count: number; principalDop: number };
}

/** Portfolio metrics computed from the database. */
export interface PortfolioMetrics {
  period: { startDate: string; endDate: string };
  loansByStatus: LoansByStatus;
  loansBySize: LoansBySize;
  totalLoans: number;
  totalPrincipalDop: number;
  totalExpectedRevenueDop: number;
  estimatedLossesPrincipalDop: number;
  estimatedRevenueLostDop: number;
  projectedCollectibleDop: number;
  projectedNetPositionDop: number;
  totalCollectedDop: number;
  defaultRateByCountPct: number;
  defaultRateByCapitalPct: number;
  collectionRatePct: number;
  onTimePaymentRatePct: number | null;
  portfolioAtRiskPct: number | null;
}

/** LLM-generated narrative for the one-page report. */
export interface ReportNarrative {
  executiveSummary: string;
  keyInsights: string[];
  riskAreas: string[];
  recommendation: string;
}
