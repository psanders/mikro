# QCobro Integration

> **Status: implemented (v1).** This document describes the shipped Mikro ↔ QCobro integration:
> the configuration surface, the tag/portfolio model, and how a push actually happens. Code:
> `mods/apiserver/src/tags/` (tag engine), `mods/apiserver/src/qcobro/` (sync service, cron worker,
> client), `mods/apiserver/src/api/tags/` (MANUAL tag API), `mods/ctl/src/commands/customers/tags/`
> (CLI). Out of scope for v1: dashboard UI for tags, ingesting QCobro interaction outcomes back into
> Mikro, multiple simultaneous balance figures per account — see "Open items" below.

## What QCobro is

QCobro (https://docs.qcobro.com) is a multilingual AI-voice collections platform. It contacts
debtors over voice, SMS, email, and WhatsApp, runs campaigns, and logs interaction outcomes
(summary, sentiment, debt reason, next steps).

Its data model:

```
Workspace
  └── Portfolio (cartera)        a collection of accounts
        └── Account              one debtor: name, phone, balance, status
              └── Campaign       outreach engine → Channels: voice / SMS / email / WhatsApp
```

## How the integration works (high level)

Mikro is the **source of truth**. QCobro is a downstream consumer. The integration is one
direction: Mikro computes who belongs in which portfolio and **pushes** that into QCobro. QCobro
never writes back into Mikro through this path (its interaction outcomes, if ever ingested, are a
separate concern).

```
┌─────────────────────────── MIKRO ────────────────────────────┐
│  ON PAYMENT ──────────┐          CRON (schedule) ─────────┐  │
│  (cure, immediate)    ▼          (decay, scheduled)       ▼  │
│                  ┌───────────────────────────────────────┐   │
│   reads:         │           TAG ENGINE                  │   │
│   Loan.status ──▶│  worst-loan rule across customer loans│   │
│   due dates ────▶│  status:*  (one, AUTO)                │   │
│   moraGraceDays ▶│  dpd:*     (one, AUTO, if past_due)   │   │
│   MANUAL tags ──▶│  risk:*    (many, untouched)          │   │
│                  └───────────────────┬───────────────────┘   │
│                                      ▼                       │
│                   evaluate portfolios[] rules (all/any/none) │
│                                      ▼                       │
│                   target portfolio set  vs  last-synced set  │
│                                      ▼ diff                  │
│                   @qcobro/sdk: upsert account                │
│                   (externalId = Mikro customerId),           │
│                   add/remove portfolios, push balance        │
└──────────────────────────────────────────────────────────────┘
```

Two forces move an account between portfolios, and they map onto the two triggers:

| Force             | Direction                                                       | Trigger                           |
| ----------------- | --------------------------------------------------------------- | --------------------------------- |
| **Payments cure** | improves standing (e.g. `past_due` → `current`)                 | **on-payment**, inline, immediate |
| **Time decays**   | worsens standing (e.g. `current` → `past_due`, bucket advances) | **cron**, on `qcobro.schedule`    |

Payments only ever improve standing, so they are handled inline the moment a payment posts.
Nothing improves merely by waiting, so the forward (deteriorating) direction is the cron's job:
it recomputes days-past-due from due dates and re-syncs. Ops actions (e.g. marking a loan
`DEFAULTED`) are reflected on the next cron tick.

## Concept mapping

| Mikro                    | QCobro                      | Notes                                                          |
| ------------------------ | --------------------------- | -------------------------------------------------------------- |
| `Customer`               | `Account`                   | identity key: Mikro `customerId` → QCobro account `externalId` |
| (computed tags + rules)  | `Portfolio` membership      | Mikro decides membership; QCobro stores it                     |
| `Loan` / `Payment` state | account `balance`, `status` | see [Balance basis](#balance-basis)                            |

A customer can hold several loans. The customer's tags are derived using the **worst-loan rule**:
the most severe loan drives the customer's `status:` and `dpd:` (standard "worst-arm" collections
practice). Portfolio assignment follows the worst exposure.

## Tags

Tags live on the Mikro **customer** (not the loan), because QCobro contacts a person (a phone),
not a loan. Tags are **hybrid**:

- **AUTO** — owned by the tag engine. Recomputed on every trigger. Humans never set these.
- **MANUAL** — asserted by a human, never touched by the engine. Set/cleared via **tRPC API and
  CTL only** (no dashboard UI in v1).

Tags are organized into three namespaces. A customer carries at most one `status:`, at most one
`dpd:` (only when delinquent), and any number of `risk:` tags.

### `status:` — lifecycle (AUTO, mutually exclusive)

| Tag                  | Meaning                                               | Derived from                                                                      |
| -------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| `status:new`         | Disbursed; first installment not yet due              | `startingDate`, no due date passed                                                |
| `status:current`     | Performing, 0 days past due                           | all installments paid to date                                                     |
| `status:pre_mora`    | Past due date but inside grace; mora not yet accruing | `moraGraceDays` / `moraEffectiveFrom` window                                      |
| `status:past_due`    | Delinquent; mora accruing                             | unpaid installment past grace                                                     |
| `status:defaulted`   | Default                                               | **`Loan.status === DEFAULTED` (trust ops).** DPD never auto-promotes to defaulted |
| `status:written_off` | Charge-off candidate                                  | DPD ≥ 180                                                                         |
| `status:completed`   | Paid off                                              | `Loan.status === COMPLETED`                                                       |

`status:defaulted` is **ops-driven**: the engine reads Mikro's manual `Loan.status` verbatim and
does not infer default from days-past-due. When a loan is `DEFAULTED`, status wins and the `dpd:`
bucket is not applied.

### `dpd:` — delinquency aging bucket / _tramo_ (AUTO, only when `past_due`)

Industry standard is **DPD (days past due)** anchored on the 30/60/90/180 cut points
(Basel / IFRS-9: 90 DPD = non-performing, 180 = charge-off). Because Mikro originates short-cycle
loans (daily/weekly), an early bucket is added below 30 for finer resolution where it matters most.

| Tag            | DPD range | Industry name                 |
| -------------- | --------- | ----------------------------- |
| `dpd:1_7`      | 1–7       | early-stage / soft collection |
| `dpd:8_30`     | 8–30      | Bucket 1                      |
| `dpd:31_60`    | 31–60     | Bucket 2                      |
| `dpd:61_90`    | 61–90     | Bucket 3                      |
| `dpd:91_180`   | 91–180    | Bucket 4 / NPL                |
| `dpd:180_plus` | 180+      | charge-off / write-off        |

Notes:

- DPD is always measured in **calendar days**, regardless of payment frequency (the standard).
- Severity differs by frequency (a daily-loan borrower at 30 DPD has missed ~30 payments; a
  monthly borrower has missed 1). DPD stays the primary signal because it is what lenders and
  QCobro speak. A secondary `installments_missed` signal is possible later if frequency-aware
  rules are ever needed.
- These buckets are the same ones used to report **PAR** (Portfolio at Risk — PAR1/30/60/90), the
  microfinance standard; existing portfolio metrics could later emit PAR off this.

### `risk:` — relationship / consent (MANUAL, API + CTL only)

| Tag                               | Use                                                             |
| --------------------------------- | --------------------------------------------------------------- |
| `risk:premium`                    | Historically good customer — exclude from aggressive portfolios |
| `risk:do_not_contact`             | Consent withdrawn — **exclude from all outbound portfolios**    |
| `risk:in_negotiation`             | Active arrangement — pause auto-dialing                         |
| `risk:payment_plan`               | On a restructured/installment plan                              |
| `risk:fraud_watch` / `risk:legal` | Escalated; handled off-platform                                 |

The engine never reads or writes `risk:` tags. They are pure human input. `risk:do_not_contact`
is the global consent gate — every portfolio rule should list it under `none`.

## Configuration

The integration is configured under a dedicated `qcobro` section in `mikro.json` (validated by the
zod schema in `mods/common/src/config.ts`). Secrets are placeholders until provided.

```jsonc
"qcobro": {
  "apiKey": "qc_PLACEHOLDER",          // QCobro server-to-server API key
  "apiSecret": "qcs_PLACEHOLDER",      // QCobro API secret
  "workspace": "ws_PLACEHOLDER",       // QCobro workspace id (isolation container)
  "syncMode": "UPDATE_EXISTING",       // APPEND_ONLY | UPDATE_EXISTING | REPLACE
  "balanceBasis": "past_due_amount",   // which money figure to push as account balance (see below)
  "schedule": "0 6 * * *",             // cron expression for the recompute+sync job; runs in the
                                       //   config timezone (America/Santo_Domingo)
  "portfolios": [
    {
      "id": "ptf_123",                 // QCobro portfolio id to assign matching customers to
      "match": {
        "any": ["dpd:8_30", "dpd:31_60"],
        "none": ["risk:premium", "risk:do_not_contact"]
      }
    }
  ]
}
```

### Field reference

| Field                  | Meaning                                                                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiKey` / `apiSecret` | QCobro credentials for server-to-server auth (used by `@qcobro/sdk`)                                                                                                                               |
| `workspace`            | QCobro workspace id; isolates portfolios/campaigns/accounts                                                                                                                                        |
| `syncMode`             | How the push reconciles with QCobro-side data. `UPDATE_EXISTING` upserts Mikro-managed accounts without disturbing accounts QCobro added elsewhere; `APPEND_ONLY` only adds; `REPLACE` overwrites  |
| `balanceBasis`         | Which Mikro money figure becomes the QCobro account `balance` (see below)                                                                                                                          |
| `schedule`             | Cron expression for the periodic recompute + sync. Evaluated in the config `timezone`. Adds a cron evaluator (e.g. `croner`) — Mikro's existing follow-up worker is interval-based, not cron-based |
| `portfolios[]`         | Ordered list of mapping rules. Each entry assigns matching customers to a QCobro portfolio                                                                                                         |

### Portfolio match rules

Each `portfolios[]` entry has an `id` (the target QCobro portfolio) and a `match` object with three
optional operators, combined with AND:

| Operator | Passes when                                         |
| -------- | --------------------------------------------------- |
| `all`    | **every** listed tag is present on the customer     |
| `any`    | **at least one** listed tag is present              |
| `none`   | **none** of the listed tags are present (exclusion) |

A customer is assigned to a portfolio when its tag set satisfies the rule. A customer can match
multiple portfolios. The original "overdue and not premium" idea is expressed as
`{ any: ["dpd:..."], none: ["risk:premium", "risk:do_not_contact"] }`. Aging-tiered portfolios
(soft vs hard collection) fall out naturally by matching different `dpd:` buckets.

## Balance basis

QCobro stores **one** `balance` per account; the AI voice agent quotes and negotiates against it. A
Mikro customer has several plausible "amount owed" figures, so `balanceBasis` selects which one is
pushed. It is a configuration knob (not hardcoded) because it changes what the dialer agent _asks
for_.

Example — one loan, principal 10,000, paid down to 6,000 remaining, 2 installments (1,300) overdue,
200 mora accrued:

| `balanceBasis`          | Balance pushed                                    | Figure |
| ----------------------- | ------------------------------------------------- | ------ |
| `outstanding_with_mora` | full payoff including mora                        | 6,200  |
| `outstanding_principal` | full payoff, no mora                              | 6,000  |
| `past_due_amount`       | overdue installments + mora (the **cure** amount) | 1,500  |
| `next_installment`      | just the next payment due                         | 650    |

Guidance:

- **Collections playbook → `past_due_amount`.** The "cure" amount gets the borrower current — the
  smallest ask, highest hit rate. This is the default for delinquency-driven portfolios.
- **Payoff / settlement playbook → `outstanding_with_mora`.** Closes the whole loan.

Across multiple loans, the basis is summed over the customer's relevant (active/delinquent) loans.

**Open item:** QCobro accounts appear to expose a single `balance`. If the agent ever needs both
the cure amount _and_ the full payoff, that requires a second QCobro field (custom account
attribute) or account metadata. v1 ships a single basis.

## Sync mechanics

1. Recompute the customer's tags (idempotent): worst-loan `status:`/`dpd:` + existing `risk:`.
2. Evaluate every `portfolios[]` rule → the customer's **target** portfolio set.
3. Diff target set against the **last-synced** set for that customer.
4. Apply the diff via `@qcobro/sdk`: upsert the account (`externalId = customerId`), add/remove
   portfolio memberships, and push `balance` per `balanceBasis`.

Idempotency: the Mikro `customerId` is the QCobro account `externalId`, so repeated syncs upsert the
same account. `syncMode: UPDATE_EXISTING` keeps Mikro from clobbering accounts QCobro manages
independently.

## Setting MANUAL tags

`risk:*` tags are set and cleared by humans, through:

- the **tRPC API** (a protected mutation), and
- the **CTL** command-line tool.

There is no dashboard UI for tags in v1. The tag engine treats `risk:*` as read-only input and
never modifies them.

## Open items

- **`@qcobro/sdk` is not a real published package.** `mods/apiserver/src/qcobro/createQCobroClient.ts`
  is a thin internal `fetch`-based client with the shape the sync service needs (`upsertAccount`,
  `setPortfolios`), using best-effort REST conventions that are **not confirmed** against QCobro's
  actual API. Swap its implementation once real docs/credentials are available — the sync service
  only depends on the `QCobroClient` interface. While `qcobro.apiKey`/`apiSecret`/`workspace` are
  still the documented `_PLACEHOLDER` values, the client is a logging no-op: AUTO tags still
  recompute on schedule, but nothing is pushed.
- **Recompute at scale** — the cron worker walks every active customer sequentially and re-fetches
  loans twice per customer (once for tag reconcile, once for balance). Fine at current volume;
  daily-loan growth may need batching or only-recompute-changed.
- **Single vs multiple balances** — see the balance-basis section above; v1 pushes one figure.
