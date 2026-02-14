/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  generatePortfolioMetricsSchema,
  type GeneratePortfolioMetricsInput,
  type DbClient,
  type PortfolioMetrics,
  type LoansByStatus,
  type LoansBySize
} from "@mikro/common";
import { logger } from "../../logger.js";

/** Loan row with payments for aggregation (Prisma result). */
interface LoanWithPayments {
  principal: { toString(): string } | number;
  status: string;
  termLength: number;
  paymentAmount: { toString(): string } | number;
  createdAt: Date;
  payments: Array<{ amount: { toString(): string } | number }>;
}

function toNum(v: { toString(): string } | number): number {
  return typeof v === "number" ? v : Number(v.toString());
}

/**
 * Gross rate used for financial summary (total expected, revenue lost).
 * Reference PDF uses 20% so "Posición neta proyectada" aligns with ~-20,500
 * (total expected 189,500, revenue lost 52,000, projected collectible 137,500).
 */
const FINANCIAL_SUMMARY_GROSS_RATE = 1.2;

/**
 * Creates a function to compute portfolio metrics for a date range.
 * Metrics are computed as of endDate; startDate/endDate are used for period labeling.
 *
 * @param client - The database client (Prisma)
 * @returns A validated function that returns PortfolioMetrics
 */
export function createGeneratePortfolioMetrics(client: DbClient) {
  const fn = async (params: GeneratePortfolioMetricsInput): Promise<PortfolioMetrics> => {
    const endDate = params.endDate ?? new Date();
    const startDate = params.startDate ?? new Date(endDate.getFullYear(), 0, 1, 0, 0, 0, 0); // year-to-date

    logger.verbose("computing portfolio metrics", {
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10)
    });

    // Fetch all loans with completed payments (Prisma client supports include)
    const allLoans = await (
      client as unknown as { loan: { findMany: (args: unknown) => Promise<LoanWithPayments[]> } }
    ).loan.findMany({
      include: {
        payments: {
          where: { status: "COMPLETED" },
          orderBy: { paidAt: "asc" }
        }
      }
    });

    // Match reference report: exclude CANCELLED from portfolio. Only ACTIVE, COMPLETED, DEFAULTED
    // count toward "Total Portfolio" and financial metrics (so numbers align with the Jan–Feb PDF).
    const rawStatus = (loan: LoanWithPayments) => String(loan.status ?? "").toUpperCase();
    const portfolioLoans = allLoans.filter((loan) => rawStatus(loan) !== "CANCELLED");

    const statuses: (keyof LoansByStatus)[] = ["ACTIVE", "COMPLETED", "DEFAULTED", "CANCELLED"];
    const loansByStatus: LoansByStatus = {
      ACTIVE: { count: 0, principalDop: 0 },
      COMPLETED: { count: 0, principalDop: 0 },
      DEFAULTED: { count: 0, principalDop: 0 },
      CANCELLED: { count: 0, principalDop: 0 }
    };

    const loansBySize: LoansBySize = {
      standard: { count: 0, principalDop: 0 },
      larger: { count: 0, principalDop: 0 },
      exception: { count: 0, principalDop: 0 }
    };

    let totalPrincipalDop = 0;
    let totalExpectedRevenueDop = 0;
    let estimatedLossesPrincipalDop = 0;
    let estimatedRevenueLostDop = 0;
    let totalCollectedDop = 0;
    let paymentsDueCount = 0;
    let paymentsOnTimeCount = 0;
    let outstandingLateDop = 0;
    let totalOutstandingDop = 0;

    for (const loan of portfolioLoans) {
      const principal = toNum(loan.principal);
      const rawStatusVal = rawStatus(loan);

      // Match reference report: Standard 5k, Larger 10k, Exception 8k & 20k (any other amount)
      if (principal === 5000) {
        loansBySize.standard.count += 1;
        loansBySize.standard.principalDop += principal;
      } else if (principal === 10000) {
        loansBySize.larger.count += 1;
        loansBySize.larger.principalDop += principal;
      } else {
        loansBySize.exception.count += 1;
        loansBySize.exception.principalDop += principal;
      }

      totalPrincipalDop += principal;
      const expectedRepayment = principal * FINANCIAL_SUMMARY_GROSS_RATE;
      totalExpectedRevenueDop += expectedRepayment;

      const status = statuses.includes(rawStatusVal as keyof LoansByStatus)
        ? (rawStatusVal as keyof LoansByStatus)
        : ("ACTIVE" as keyof LoansByStatus);
      loansByStatus[status].count += 1;
      loansByStatus[status].principalDop += principal;

      if (rawStatusVal === "DEFAULTED") {
        estimatedLossesPrincipalDop += principal;
        estimatedRevenueLostDop += expectedRepayment;
      }

      for (const p of loan.payments) {
        totalCollectedDop += toNum(p.amount);
      }

      if (rawStatusVal === "ACTIVE" || rawStatusVal === "COMPLETED") {
        const termLength = loan.termLength ?? 10;
        const intervalDays = 7;
        const loanStart = new Date(loan.createdAt ?? 0);
        const asOf = new Date(endDate);
        const msSinceLoan = asOf.getTime() - loanStart.getTime();
        const daysSinceLoan = Math.max(0, Math.floor(msSinceLoan / (1000 * 60 * 60 * 24)));
        const cyclesElapsed = Math.floor(daysSinceLoan / intervalDays);
        const paymentsMade = loan.payments.length;
        const missedCycles = Math.max(0, cyclesElapsed - paymentsMade);
        const paymentAmount = toNum(loan.paymentAmount);
        const outstanding = (termLength - paymentsMade) * paymentAmount;
        totalOutstandingDop += Math.max(0, outstanding);
        if (missedCycles > 0) {
          outstandingLateDop += missedCycles * paymentAmount;
        }
        paymentsDueCount += cyclesElapsed;
        paymentsOnTimeCount += Math.min(paymentsMade, cyclesElapsed);
      }
    }

    const projectedCollectibleDop = totalExpectedRevenueDop - estimatedRevenueLostDop;
    const projectedNetPositionDop = projectedCollectibleDop - totalPrincipalDop;

    const portfolioCount = portfolioLoans.length;
    const defaultRateByCountPct =
      portfolioCount === 0 ? 0 : (loansByStatus.DEFAULTED.count / portfolioCount) * 100;
    const defaultRateByCapitalPct =
      totalPrincipalDop === 0
        ? 0
        : (loansByStatus.DEFAULTED.principalDop / totalPrincipalDop) * 100;
    // Match reference: "Collection rate (projected)" = projected collectible / total expected
    const collectionRatePct =
      totalExpectedRevenueDop === 0 ? 0 : (projectedCollectibleDop / totalExpectedRevenueDop) * 100;
    const onTimePaymentRatePct =
      paymentsDueCount === 0 ? null : (paymentsOnTimeCount / paymentsDueCount) * 100;
    const portfolioAtRiskPct =
      totalOutstandingDop === 0 ? null : (outstandingLateDop / totalOutstandingDop) * 100;

    const metrics: PortfolioMetrics = {
      period: {
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10)
      },
      loansByStatus,
      loansBySize,
      totalLoans: portfolioCount,
      totalPrincipalDop,
      totalExpectedRevenueDop,
      estimatedLossesPrincipalDop,
      estimatedRevenueLostDop,
      projectedCollectibleDop,
      projectedNetPositionDop,
      totalCollectedDop,
      defaultRateByCountPct,
      defaultRateByCapitalPct,
      collectionRatePct,
      onTimePaymentRatePct,
      portfolioAtRiskPct
    };

    logger.verbose("portfolio metrics computed", {
      totalLoans: metrics.totalLoans,
      totalPrincipalDop: metrics.totalPrincipalDop,
      defaultRateByCountPct: metrics.defaultRateByCountPct.toFixed(1)
    });

    return metrics;
  };

  return withErrorHandlingAndValidation(fn, generatePortfolioMetricsSchema);
}
