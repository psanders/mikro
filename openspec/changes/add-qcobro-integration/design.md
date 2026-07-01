# Design — QCobro Integration

> Companion to `QCOBRO.md` (repo root), which is the operator-facing reference. This file records
> the engineering decisions and trade-offs behind the change.

## Context

- QCobro is downstream and write-only from Mikro's side: Mikro decides portfolio membership and
  pushes it. No write-back in v1.
- Mikro entities: a `Customer` (the debtor / "account") holds many `Loan`s; financial state
  (status, due dates, mora) lives on `Loan`/`Payment`. There is no existing tag, consent, or
  notification concept on `Customer`.
- Existing patterns reused: zod config in `mods/common/src/config.ts`; an in-process worker started
  from `mods/apiserver/src/index.ts` (the follow-up worker polls every 30s); payment side effects
  fired from `createCreatePayment`.

## Decision 1 — Hybrid tags, stored, two AUTO axes + manual axis

Tags are stored (not purely derived) so that MANUAL assertions (`risk:premium`,
`risk:do_not_contact`) and history can coexist with AUTO-derived state. Each tag carries a
`source`:

- `AUTO` — engine owns it; recomputed (idempotent upsert/delete) on every trigger.
- `MANUAL` — human owns it; the engine never reads it for derivation decisions and never deletes it.

Three namespaces keep the predicate language clean: `status:` (one, AUTO), `dpd:` (one, AUTO, only
when delinquent), `risk:` (many, MANUAL). Full tag list in `QCOBRO.md`.

**Why not derive-only:** consent and relationship facts are not derivable from loan state. **Why not
a single flat list:** mixing lifecycle, aging, and consent makes rules ambiguous and AUTO/MANUAL
ownership unclear.

## Decision 2 — Worst-loan aggregation

A customer with several loans takes the most severe loan's `status:`/`dpd:` (the standard
"worst-arm" rule). Portfolio assignment follows worst exposure. Severity order:
`defaulted > written_off > past_due (higher dpd worse) > pre_mora > current > completed/new`.
`completed`/`new` only apply when no loan is in a worse state.

## Decision 3 — `status:defaulted` trusts ops

The engine reads `Loan.status === DEFAULTED` verbatim and does **not** promote a loan to defaulted
from DPD. When a loan is DEFAULTED, `status:defaulted` applies and no `dpd:` bucket is set for it.
This keeps a single human-controlled source for "default" and avoids a second, divergent definition.
Consequence: an ops DEFAULTED flip is reflected on the next cron tick (≤ one schedule interval lag),
which is acceptable.

## Decision 4 — DPD buckets

Anchored on the standard 30/60/90/180 cut points (Basel/IFRS-9), with an extra `1_7` early bucket
because Mikro originates daily/weekly loans where the first week matters. DPD is calendar days,
frequency-independent (the standard). A frequency-aware `installments_missed` signal is deferred.

## Decision 5 — Tag storage shape: dedicated table

Use a `CustomerTag` table (`customerId`, `tag`, `source`, `setAt`, unique on
`(customerId, tag)`) rather than a JSON column on `Customer`.

|                                         | `CustomerTag` table   | JSON column on `Customer` |
| --------------------------------------- | --------------------- | ------------------------- |
| Sync query ("all customers with tag X") | indexed, direct       | full scan + JSON parse    |
| Per-tag `source`/`setAt`/history        | natural               | awkward                   |
| Write granularity                       | upsert/delete one row | rewrite whole array       |
| Migration cost                          | new table             | none                      |

The indexed query matters because the cron sync walks the customer base. Chosen: the table.

## Decision 6 — Sync diffing and idempotency

Mikro `customerId` is the QCobro account `externalId`, so account upserts are idempotent. To avoid
re-pushing unchanged memberships every tick, persist the **last-synced portfolio set** per customer
(a `lastSyncedPortfolios` JSON field on `Customer`, or a small side table). Each sync computes the
target set, diffs against last-synced, applies only the delta via `@qcobro/sdk`, then records the new
set. `syncMode: UPDATE_EXISTING` (default) prevents Mikro from clobbering accounts QCobro manages
independently.

## Decision 7 — Triggers and scheduler

- **On-payment** (inline): payments only improve standing, so recompute + sync the affected customer
  immediately from the existing `createCreatePayment` side-effect path.
- **Cron** (`qcobro.schedule`): deterioration is time-driven with no event, so a cron job recomputes
  DPD/status across the base and re-syncs. This needs a cron-expression scheduler evaluated in the
  config `timezone`; add `croner` (tiny, zero-dep, TZ-aware). The existing follow-up worker stays
  interval-based; the two coexist.

No generic loan-status-change trigger: ops actions surface on the next cron tick, which is
sufficient and avoids wiring a change feed.

## Decision 8 — Balance basis

QCobro stores one `balance` per account. `balanceBasis` config selects which Mikro figure is pushed
(`outstanding_with_mora`, `outstanding_principal`, `past_due_amount`, `next_installment`), summed
over the customer's relevant loans. Default `past_due_amount` (the cure amount) suits
delinquency-driven portfolios. See `QCOBRO.md` for the worked example.

## Open questions

- **Recompute at scale.** Daily-loan volume may make a full-base cron recompute heavy. Likely needs
  batching / only-recompute-changed. Acceptable to start naive and optimize.
- **Multiple balances.** If the voice agent ever needs both cure and full-payoff amounts, that needs
  a QCobro custom attribute or account metadata; single basis for v1.
- **QCobro auth specifics.** Docs mention both bearer-token + workspace header and server-to-server
  API keys, plus HTTP Basic for contact-logs. Confirm exactly which `@qcobro/sdk` expects for
  portfolio/account writes before wiring credentials.
- **Interaction outcomes.** Ingesting QCobro call results (sentiment, promises-to-pay) back into
  Mikro is explicitly out of scope here but is the natural next change.
