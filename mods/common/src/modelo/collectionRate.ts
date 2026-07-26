/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Translates an observed collection rate into the projection engine's
 * `tasaDefault` lever.
 *
 * The Modelo engine has no "pays part of the schedule and stalls" state: a
 * loan either defaults (losing its remaining principal) or pays every cuota in
 * full. Real books are not like that — Mikro collects a fraction of what its
 * schedules say is due. Feeding the engine only the formally-DEFAULTED share
 * therefore models a business that collects 100% of everything else, which is
 * wildly optimistic.
 *
 * In the engine a loan rolls a default check once per payment period with
 * probability d = tasaDefault / term, so the expected share of scheduled
 * cuotas it pays is
 *
 *   CR(d) = (1 - d) · (1 - (1 - d)^term) / (d · term)
 *
 * These helpers invert that closed form: given the collection rate the book
 * actually achieves, they return the tasaDefault that reproduces it. No engine
 * formula is modified — this only picks the input.
 */

/** Expected share of scheduled cuotas collected, given a per-period default probability. */
export function collectionRateForPeriodDefault(d: number, term: number): number {
  if (term <= 0) return 0;
  if (d <= 0) return 1;
  if (d >= 1) return 0;
  return ((1 - d) * (1 - (1 - d) ** term)) / (d * term);
}

/**
 * Lowest collection rate the engine can express for a given term.
 *
 * `tasaDefault` is a share of loans, so it cannot exceed 1, which pins the
 * per-period probability at 1/term. A book collecting less than this is off
 * the bottom of the engine's scale and {@link defaultRateForCollectionRate}
 * saturates at 1 instead of matching it.
 */
export function minRepresentableCollectionRate(term: number): number {
  if (!(term > 0)) return 0;
  return collectionRateForPeriodDefault(1 / term, term);
}

/**
 * Inverse of {@link collectionRateForPeriodDefault}, expressed as the engine's
 * whole-term `tasaDefault`. Monotonic in d, so a bisection is exact enough.
 * Saturates at 1 below {@link minRepresentableCollectionRate}.
 */
export function defaultRateForCollectionRate(collectionRate: number, term: number): number {
  if (!(term > 0)) return 0;
  if (collectionRate >= 1) return 0;
  if (collectionRate <= 0) return 1;

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (collectionRateForPeriodDefault(mid, term) > collectionRate) lo = mid;
    else hi = mid;
  }
  const perPeriod = (lo + hi) / 2;
  return Math.min(1, perPeriod * term);
}

/**
 * Blend the observed collection rate with an assumption about how much of the
 * past-due money is eventually recovered.
 *
 * `recovery` 0 = nothing overdue ever arrives (what the closed-loan history
 * suggests); 1 = every peso currently late is collected in full, which reduces
 * the model back to formally-defaulted loans only.
 */
export function assumedCollectionRate(observedRate: number, recovery: number): number {
  const r = Math.min(1, Math.max(0, recovery));
  return Math.min(1, observedRate + r * (1 - observedRate));
}

/**
 * The engine's `tasaDefault` for an observed collection rate and a recovery
 * assumption, floored at the formally-defaulted share (loans already written
 * off are lost no matter how well collections improve).
 */
export function effectiveDefaultRate(options: {
  collectionRate: number;
  term: number;
  recovery: number;
  formalLossRate: number;
}): number {
  const assumed = assumedCollectionRate(options.collectionRate, options.recovery);
  const derived = defaultRateForCollectionRate(assumed, options.term);
  return Math.min(1, Math.max(derived, options.formalLossRate));
}
