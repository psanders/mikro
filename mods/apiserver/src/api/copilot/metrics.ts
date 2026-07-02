/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Watch-rule metric computations (design Decision 5). All three v1 metrics are
 * derived from current business data:
 *
 *  - mora_pct_portfolio  — share (%) of ACTIVE loans that are overdue.
 *  - mora_pct_collector  — same, scoped to one collector's customers.
 *  - cobranza_diaria     — sum of today's non-REVERSED payment amounts.
 *
 * "Overdue" is defined exactly as the rest of the codebase defines arrears:
 * `getCycleMetrics(...).missedCycles > 0`, i.e. at least one due installment
 * cycle has elapsed without a matching COMPLETED payment (LATE_FEE rows are
 * excluded by `toLoanPaymentData`). This keeps the copilot's mora numbers
 * consistent with the reports and the QCobro tag engine.
 */
import { getCycleMetrics, toLoanPaymentData, amountToNumber } from "@mikro/common";
import type { WatchRuleMetric } from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";

export interface MetricComputationInput {
  metric: WatchRuleMetric;
  /** Required for mora_pct_collector; ignored otherwise. */
  collectorId?: string | null;
}

const activeLoanSelect = {
  paymentFrequency: true,
  createdAt: true,
  startingDate: true,
  termLength: true,
  payments: { select: { paidAt: true, status: true, kind: true, amount: true } },
  customer: { select: { preferredPaymentDay: true } }
} as const;

/**
 * Percentage of ACTIVE loans that are overdue, optionally scoped to a
 * collector's assigned customers. Returns 0 when there are no active loans.
 */
async function computeMoraPct(
  db: PrismaClient,
  collectorId: string | undefined,
  asOf: Date
): Promise<number> {
  const loans = await db.loan.findMany({
    where: {
      status: "ACTIVE",
      ...(collectorId ? { customer: { assignedCollectorId: collectorId } } : {})
    },
    select: activeLoanSelect
  });

  if (loans.length === 0) return 0;

  let overdue = 0;
  for (const loan of loans) {
    const data = toLoanPaymentData({
      paymentFrequency: loan.paymentFrequency,
      createdAt: loan.createdAt,
      startingDate: loan.startingDate,
      termLength: loan.termLength,
      payments: loan.payments,
      customer: { preferredPaymentDay: loan.customer.preferredPaymentDay }
    });
    if (getCycleMetrics(data, asOf).missedCycles > 0) overdue += 1;
  }

  return (overdue / loans.length) * 100;
}

/**
 * Sum of the amounts of all non-REVERSED payments recorded today (from local
 * midnight of `asOf` up to `asOf`).
 */
async function computeCobranzaDiaria(db: PrismaClient, asOf: Date): Promise<number> {
  const startOfDay = new Date(asOf);
  startOfDay.setHours(0, 0, 0, 0);

  const payments = await db.payment.findMany({
    where: { paidAt: { gte: startOfDay, lte: asOf }, status: { not: "REVERSED" } },
    select: { amount: true }
  });

  return payments.reduce((sum, p) => sum + amountToNumber(p.amount), 0);
}

/**
 * Compute a watch-rule metric's current value.
 *
 * @param db - Prisma client
 * @param input - The metric to compute and its optional collector scope
 * @param asOf - Evaluation instant (defaults to now); injectable for tests
 */
export async function computeWatchMetric(
  db: PrismaClient,
  input: MetricComputationInput,
  asOf: Date = new Date()
): Promise<number> {
  switch (input.metric) {
    case "mora_pct_portfolio":
      return computeMoraPct(db, undefined, asOf);
    case "mora_pct_collector":
      return computeMoraPct(db, input.collectorId ?? undefined, asOf);
    case "cobranza_diaria":
      return computeCobranzaDiaria(db, asOf);
    default: {
      // Exhaustiveness guard: a new enum member must add a branch above.
      const _exhaustive: never = input.metric;
      throw new Error(`Unsupported watch metric: ${String(_exhaustive)}`);
    }
  }
}

/** True when `value` breaches `threshold` under `comparator` ("gt" | "lt"). */
export function isBreached(value: number, comparator: string, threshold: number): boolean {
  return comparator === "gt" ? value > threshold : value < threshold;
}
