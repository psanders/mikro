/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * FIFO waterfall-allocation helper. Given a loan's INSTALLMENT payment rows and
 * the cuota amount + term length, it allocates cumulative non-reversed money
 * across cuotas: cuota N is covered once cumulative installment money paid
 * reaches N × cuota, and the remainder spills onto the next cuota.
 *
 * This is the ONE implementation of that allocation. Reports and scripts must
 * reuse it rather than re-deriving a per-cuota schedule by hand (the #10036
 * dispute script did exactly that and violated the snapshot docstring rule).
 *
 * Pure and snapshot-in: it consumes framework-agnostic payment rows (plain
 * amounts, dates as string | Date), not Prisma rows, so it is storage-agnostic
 * and unit-testable with fixtures.
 */
import { z } from "zod/v4";
import { ValidationError } from "../errors/ValidationError.js";
import { paymentKindEnum, paymentStatusEnum } from "../schemas/payment.js";

/** Money comparisons tolerate sub-cent float noise (matches the eval framework). */
const EPS = 0.01;

/** One payment row fed to the allocator. Mirrors the snapshot ledger shape. */
export const allocationPaymentSchema = z.object({
  kind: paymentKindEnum,
  status: paymentStatusEnum,
  amount: z.number(),
  /** ISO string or Date; sorted ascending before allocation. */
  paidAt: z.union([z.string(), z.date()])
});

export const allocationInputSchema = z.object({
  /** ALL payment rows; the allocator filters to countable INSTALLMENT rows. */
  payments: z.array(allocationPaymentSchema),
  /** Cuota — expected amount per period. */
  cuota: z.number().positive(),
  /** Number of cuotas in the loan term. */
  termLength: z.number().int().positive()
});

export type AllocationPayment = z.infer<typeof allocationPaymentSchema>;
export type AllocationInput = z.infer<typeof allocationInputSchema>;

/** Per-cuota result of the waterfall allocation. */
export interface CuotaAllocation {
  /** 1-based cuota number. */
  cuota: number;
  /** Money applied to this cuota (0..cuota). */
  amountApplied: number;
  /** True once cumulative money paid reaches cuota × N. */
  covered: boolean;
  /** ISO date of the payment that fully covered this cuota, or null. */
  coverageDate: string | null;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Allocate a loan's non-reversed INSTALLMENT money across its cuotas by FIFO
 * waterfall. Only COMPLETED and PARTIAL INSTALLMENT rows contribute; REVERSED
 * and PENDING rows are excluded so undone/unsettled money never advances a
 * cuota. Throws {@link ValidationError} on malformed input (no output produced).
 *
 * @param input - payments (raw ledger), cuota amount, and term length
 * @returns exactly `termLength` allocation rows, cuota 1..T
 */
export function allocatePaymentsToCuotas(input: AllocationInput): CuotaAllocation[] {
  const parsed = allocationInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error);
  }
  const { payments, cuota, termLength } = parsed.data;

  const countable = payments
    .filter((p) => p.kind === "INSTALLMENT" && (p.status === "COMPLETED" || p.status === "PARTIAL"))
    .map((p) => ({ amount: p.amount, paidAt: new Date(p.paidAt) }))
    .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());

  const coverageDates: (Date | null)[] = new Array(termLength).fill(null);
  let running = 0;
  for (const p of countable) {
    const before = running;
    running += p.amount;
    // Mark every cuota threshold this payment newly crossed.
    for (let n = 1; n <= termLength; n++) {
      const threshold = n * cuota;
      if (coverageDates[n - 1] === null && before + EPS < threshold && running + EPS >= threshold) {
        coverageDates[n - 1] = p.paidAt;
      }
    }
  }

  const total = running;
  const allocations: CuotaAllocation[] = [];
  for (let n = 1; n <= termLength; n++) {
    const prevThreshold = (n - 1) * cuota;
    const amountApplied = Math.max(0, Math.min(cuota, total - prevThreshold));
    const covered = total + EPS >= n * cuota;
    allocations.push({
      cuota: n,
      amountApplied: round2(amountApplied),
      covered,
      coverageDate: coverageDates[n - 1] ? coverageDates[n - 1]!.toISOString() : null
    });
  }
  return allocations;
}
