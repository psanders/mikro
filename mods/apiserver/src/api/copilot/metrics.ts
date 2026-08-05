/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Copilot metric computations.
 *
 * This module previously backed the watch-rule evaluator with three metrics
 * (mora_pct_portfolio, mora_pct_collector, cobranza_diaria). Watch rules were
 * retired as never-used, and the two mora metrics had no consumer outside the
 * evaluator, so only the daily-cash figure remains — it is what the
 * `getDailyCashCollected` read tool answers with when the founder is closing
 * out the day and reconciling against a physical count.
 */
import { amountToNumber } from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";

/**
 * Sum of the amounts of all non-REVERSED payments recorded today (from local
 * midnight of `asOf` up to `asOf`).
 *
 * @param db - Prisma client
 * @param asOf - Evaluation instant (defaults to now); injectable for tests
 */
export async function computeDailyCashCollected(
  db: PrismaClient,
  asOf: Date = new Date()
): Promise<number> {
  const startOfDay = new Date(asOf);
  startOfDay.setHours(0, 0, 0, 0);

  const payments = await db.payment.findMany({
    where: { paidAt: { gte: startOfDay, lte: asOf }, status: { not: "REVERSED" } },
    select: { amount: true }
  });

  return payments.reduce((sum, p) => sum + amountToNumber(p.amount), 0);
}
