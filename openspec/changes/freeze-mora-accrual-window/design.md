## Context

`computeAccruedMora` is a pure function of the loan's _current_ state. It finds
the oldest missed due date (`getDueDateForCycle(loanStart, paymentsMade, …)`),
measures `daysLate` from it, computes `rate × days/30 × cuota`, and subtracts
LATE_FEE money collected inside that same window:

```
netMora = max(0, grossMora(oldestMissedDue → asOf) − collected[oldestMissedDue, asOf])
```

`paymentsMade` is money-based (`floor(totalInstallmentPaid / cuota)`), so the
anchor `oldestMissedDue` moves forward the instant a payment pushes the running
total past another cuota boundary. Mora is charged _before_ that money is
applied — correctly, since that is the state the customer was in when the
collector arrived — but every later read recomputes gross from the _new_ anchor.
The charge is history; the yardstick keeps moving.

Loan #10029 is the worked example: charged at 19 days from 05 jul (RD$76),
re-read at 17 days from 19 jul (RD$68). The `max(0, …)` clamp turns the RD$8
difference into nothing at all — no credit, no flag, and `mora-net-nonneg`
passes because it asserts exactly that clamp.

Constraints:

- The engine is shared verbatim by the server, the collector app (via the
  offline snapshot) and the statement. Whatever we do must stay pure and
  computable from a snapshot, offline included.
- Historical LATE_FEE rows carry no record of how they were computed. Whatever
  we do must degrade to today's behaviour for them.
- Money already collected is not in question. This is about which number the
  system calls correct afterwards.

## Goals / Non-Goals

**Goals:**

- A charged mora window stops moving once the money is taken: `generada ≥
pagada` for any window charged after this change.
- An over-collected window is visible as a failed control rather than clamped
  to zero.
- Historical rows keep behaving exactly as they do today — no silent restatement
  of past charges.
- The engine stays pure and offline-computable.

**Non-Goals:**

- Refunding or crediting the RD$8-style overages that already exist. The user's
  decision is to freeze the window, not to settle past differences.
- Changing the rate, grace, cap, minimum, or stop-on-default behaviour.
- Changing what the collector is told to charge at the door.
- Backfilling anchors onto historical LATE_FEE rows by inference.

## Decisions

### Persist the accrual anchor on the LATE_FEE row

Add a nullable `moraAccrualFrom` (DateTime) to `Payment`, written only for
LATE_FEE rows, holding the accrual start the charge was computed from — i.e.
`max(oldestMissedDue, moraEffectiveFrom)` as evaluated at charge time.

`computeAccruedMora` then measures gross from the earliest anchor among the
LATE_FEE rows in the current window, falling back to the live oldest-missed-due
when no row carries one.

_Alternative — store the gross amount instead of the anchor._ Simpler to read,
but it freezes the number rather than the window: mora keeps accruing after the
charge, and a stored total cannot express "and it has been growing since". The
anchor keeps the engine a function of time, which is what every downstream
consumer expects.

_Alternative — never move the anchor while any cycle is missed._ Would fix this
case without a schema change, but it changes accrual for loans that have no
mora history at all, and it makes the anchor unknowable from the ledger.
Persisting the fact is worth the column.

### Anchor selection: earliest anchor in the window

When several LATE_FEE rows fall inside the current window, gross is measured
from the _earliest_ stored anchor. That keeps gross ≥ the sum of the charges
that were computed against it, which is precisely the invariant we want. Taking
the latest anchor would reintroduce the bug one charge later.

### Fall back, never infer

A LATE_FEE row with `moraAccrualFrom = null` contributes no anchor. If no row in
the window has one, behaviour is byte-identical to today. This is what keeps the
change safe to deploy against a live database with years of history: old rows
are not reinterpreted, they are simply not consulted.

### Split the health check

`mora-net-nonneg` currently asserts `moraAccrued === max(0, gross − collected)`
— the clamp. Keep it as a genuine invariant of the returned value, but add
`mora-not-over-collected`, severity `warning`, which fails when
`collected > gross + ε` for the same window. The statement's verification banner
then reports the contradiction instead of printing "12/12 superados" above it.

Old loans will trip the new check. That is the point — it surfaces existing
over-collections rather than manufacturing a clean bill of health — but it means
the banner will show failures on historical loans immediately after deploy.

## Risks / Trade-offs

- **The new check fires on historical loans on day one** → It is a `warning`,
  not an `error`, and the statement already renders per-check detail, so the
  banner explains which control failed and why. Expect a visible jump in flagged
  loans; that is surfaced debt, not new breakage.
- **Anchor written in one place, read in another** → The anchor is only correct
  if it is the same value the charge used. Write it inside the same transaction
  that creates the LATE_FEE row, from the `computeAccruedMora` result that
  produced the charge, never recomputed at write time.
- **Integration suite drifts from the migration** → The hand-maintained
  `SCHEMA_SQL` in the integration tests is a separate source of truth from
  `prisma/migrations`. Both must gain the column, or integration tests fail in a
  way that looks unrelated.
- **Offline snapshot lacks the column until the collector app syncs** → The
  local SQLite mirror must carry `moraAccrualFrom` or the app computes a
  different mora than the server. Add it to the sync payload and the local
  schema in the same change.
- **Frozen windows can over-state mora on a cured loan** → If a customer clears
  every missed cycle, `missedCycles` drops to 0 and the engine returns zero mora
  before the anchor is ever consulted. The anchor only matters while the loan is
  still behind.

## Migration Plan

1. Additive, nullable column — no backfill, no data rewrite. Deploy the schema
   ahead of the code; the column is simply unread until the new code lands.
2. Server writes anchors from first deploy. Only windows charged afterwards are
   frozen.
3. The collector app picks up the field through the normal sync pull. Until it
   ships, the app computes the pre-change mora — the server is authoritative on
   the split, so this is a display lag, not a money difference.
4. Rollback: stop writing the column. Readers already tolerate `null`, so
   reverting the code needs no schema change.

## Open Questions

- Should a reversed LATE_FEE row release its anchor? Reversal already excludes
  the row from `collected`; leaving the anchor in place keeps gross high with
  nothing charged against it. Leaning toward excluding reversed rows from anchor
  selection as well, matching how they are excluded from the collected sum.
