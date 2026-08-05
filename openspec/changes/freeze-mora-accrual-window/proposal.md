## Why

Mora is charged against the delinquency state at the moment the collector takes
the money, but `computeAccruedMora` recomputes gross mora from the _current_
oldest missed due date every time it runs. Applying the payment moves that due
date forward, so the very payment that carried the mora retroactively shrinks
the window the mora was charged against.

Loan #10029 (2026-08-05): the collector charged RD$76.00 of mora — 19 accrual
days from the then-oldest missed due (05 jul). The same RD$1,200 closed cuota 8,
moving the oldest missed due to 19 jul, so gross for the new window is RD$68.00.
The statement now prints "RD$68.00 generada − RD$76.00 pagada" while
`lateFee.ts` clamps the net with `Math.max(0, gross − collected)`, silently
swallowing the RD$8.00 overage. No credit is recorded, nothing is flagged, and
the health check prints "12/12 controles superados" two lines above the
contradiction — because `mora-net-nonneg` asserts the clamp itself.

This is small per payment and compounds across every partial-paying loan, and it
makes the statement — the document handed to customers and used to settle
disputes — self-contradicting.

## What Changes

- Mora accrual is anchored at charge time. When a LATE_FEE row is created, the
  accrual start it was computed from is persisted with it. Gross mora for that
  window is recomputed from the stored anchor rather than from wherever the
  oldest missed due has since moved, so "generada" can never fall below
  "pagada".
- Loans with no stored anchor (every LATE_FEE row written before this change)
  keep today's behaviour — the anchor is derived from the oldest missed due as
  it is now. No backfill, no recomputation of historical charges.
- The `mora-net-nonneg` health check is split: netting stays an invariant, and a
  new check **fails** when collected mora exceeds gross for the same window,
  instead of asserting the clamp that hides it.
- The loan statement stops reporting a mora line that reads as an
  over-collection. With the anchor in place, `generada ≥ pagada` holds for any
  loan whose mora was charged after this change.
- No refunds and no change to what any customer is asked to pay. This changes
  which number the system considers correct after the fact, not the amount
  collected at the door.

## Capabilities

### New Capabilities

- `mora-accrual`: How past-due fees accrue, when the accrual window opens and
  closes, what happens to the window when a payment lands, and what the system
  guarantees about gross vs collected mora. No spec covers mora today, so this
  captures existing behaviour (rate, grace, cap, minimum, netting, stop-on-
  default) alongside the new anchoring rule.

### Modified Capabilities

- `loan-statement-report`: the mora KPI and the verification banner. The
  statement must surface an over-collected mora window as a failed control
  rather than clamping it to zero and reporting all controls passed.

## Impact

- `mods/common/src/utils/lateFee.ts` — `computeAccruedMora` gains an accrual
  anchor input; gross is measured from it when present.
- `mods/common/src/utils/loanMoraHelpers.ts` — `toCollectedLateFeePayments`
  carries the stored anchor through to the engine.
- `mods/apiserver/prisma/schema.prisma` + migration — nullable accrual-anchor
  column on `Payment` (set on LATE_FEE rows only). The integration suite's
  hand-maintained `SCHEMA_SQL` needs the same column.
- `mods/apiserver/src/api/payments/createCreatePayment.ts` — persists the anchor
  when writing a LATE_FEE row.
- `mods/common/src/eval/checks.ts` — `mora-net-nonneg` reworked, new
  over-collection check; `mods/common/src/eval/snapshot.ts` exposes the anchor.
- `mods/common/src/reporting/loanStatement.ts` — mora KPI copy and the banner's
  failed-control path.
- Collector app reads mora through the snapshot and needs no change.
