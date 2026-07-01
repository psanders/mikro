# QCobro Integration

> **Status: implemented (v1), pushing for real via `@qcobro/sdk`.** This document describes the
> shipped Mikro ↔ QCobro integration: the configuration surface, the tag/portfolio model, and how a
> push actually happens. Code: `mods/apiserver/src/tags/` (tag engine), `mods/apiserver/src/qcobro/`
> (sync service, cron worker, client), `mods/apiserver/src/api/tags/` (MANUAL tag API),
> `mods/ctl/src/commands/customers/tags/` (CLI). `createQCobroClient.ts` uses the real, published
> `@qcobro/sdk` — end-to-end tested against a live QCobro workspace. Out of scope for v1: dashboard
> UI for tags, ingesting QCobro interaction outcomes back into Mikro, multiple simultaneous balance
> figures per account — see "Open items" below.

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
┌─────────────────────────────── MIKRO ────────────────────────────────┐
│  ON PAYMENT ──────────┐              CRON (schedule) ─────────────┐  │
│  (cure, immediate)    ▼              (decay, scheduled)           ▼  │
│           ┌─────────────────────────────────────────────────────┐    │
│  for every│                  TAG ENGINE (per customer)           │   │
│  active   │  worst-loan rule across customer loans               │   │
│  customer:│  status:*  (one, AUTO)   dpd:* (one, AUTO if past_due)│  │
│           │  risk:*    (many, untouched, MANUAL)                 │   │
│           └────────────────────────┬────────────────────────────┘    │
│                                    ▼                                 │
│                evaluate portfolios[] rules (all/any/none) per        │
│                customer → bucket into a per-portfolio account-row    │
│                list (every matching customer, not just the payer)    │
│                                    ▼                                 │
│        for each portfolio WITH matching customers (≥1 row):          │
│          syncAccounts({ portfolioId, mode, rows: [...] })            │
│          ── ONE BATCH CALL per portfolio, never per customer ──      │
└──────────────────────────────────────────────────────────────────────┘
```

Two forces move an account between portfolios, and they map onto the two triggers — both run the
**same full pass** (every active customer, every portfolio); a payment just runs it on demand
instead of waiting for the clock:

| Force             | Direction                                                       | Trigger                           |
| ----------------- | --------------------------------------------------------------- | --------------------------------- |
| **Payments cure** | improves standing (e.g. `past_due` → `current`)                 | **on-payment**, inline, immediate |
| **Time decays**   | worsens standing (e.g. `current` → `past_due`, bucket advances) | **cron**, on `qcobro.schedule`    |

Payments only ever improve standing, so they are handled inline the moment a payment posts.
Nothing improves merely by waiting, so the forward (deteriorating) direction is the cron's job:
it recomputes days-past-due from due dates and re-syncs. Ops actions (e.g. marking a loan
`DEFAULTED`) are reflected on the next cron tick.

**Why a full pass, not just the paying customer:** QCobro's real `portfolios.syncAccounts` call
pushes a portfolio's **entire** account list in one batch (`mode: REPLACE` replaces the whole set
with whatever is in that call). Pushing just the one customer who paid would, under `REPLACE`, wipe
every other account out of that portfolio. So every sync — cron or on-payment — re-evaluates every
active customer against every portfolio rule and pushes one complete batch per portfolio.

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

| Field                  | Meaning                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiKey` / `apiSecret` | QCobro credentials for server-to-server auth                                                                                                                                                            |
| `workspace`            | QCobro workspace id; isolates portfolios/campaigns/accounts                                                                                                                                             |
| `apiUrl`               | QCobro API base (default `https://api.qcobro.com`)                                                                                                                                                      |
| `syncMode`             | Passed through to every `syncAccounts` call as `mode`. `REPLACE` replaces a portfolio's entire account set each push; `UPDATE_EXISTING` upserts rows without touching the rest; `APPEND_ONLY` only adds |
| `balanceBasis`         | Which Mikro money figure becomes each row's `outstandingBalance` (see below)                                                                                                                            |
| `schedule`             | Cron expression for the periodic recompute + sync. Evaluated in the config `timezone` via `croner` — Mikro's existing follow-up worker is interval-based, not cron-based                                |
| `dryRun`               | Default `false`. When `true`, `createQCobroClient` logs the `syncAccounts` batch it would send instead of calling `@qcobro/sdk` — safe for iterating on tags/portfolio rules without touching QCobro    |
| `portfolios[]`         | Ordered list of mapping rules. Each entry's matching customers become one `syncAccounts` batch for that portfolio id                                                                                    |

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

Every sync (cron or on-payment) is a **full pass** over every active customer:

1. For each active customer: recompute tags (idempotent upsert/delete of `status:`/`dpd:`,
   `risk:` untouched), then evaluate every `portfolios[]` rule against the customer's current tag
   set.
2. Bucket each matching customer into that portfolio's row list for this pass (a customer can land
   in more than one portfolio's list). Each row carries: `externalId` (= Mikro `customerId`),
   `fullName`, `phone`, `principalAmount`/`termsAmount`/`termsFrequency`/`termsLength` (from the
   customer's worst loan — the same one driving `status:`/`dpd:`), `outstandingBalance` (per
   `balanceBasis`, summed across relevant loans), `daysPastDue`/`missedInstallments` (the worst
   loan's real numbers, tracked even when `status:defaulted` trusts ops over DPD), and
   `lastPaymentDate`/`lastPaymentAmount` (most recent completed installment, if any).
3. For each `portfolios[]` entry with at least one matching customer, push **one** batch:
   `syncAccounts({ portfolioId, mode: syncMode, rows })`. A portfolio with zero matching customers
   this pass is **skipped** — the real API has no "clear this portfolio" call, so it's left as-is.
4. Persist each customer's current target-portfolio set (`Customer.lastSyncedPortfolios`) for
   bookkeeping, regardless of whether step 3 actually pushed (audit trail of intent even when the
   API couldn't express it).

This is a portfolio-batch design, not a per-customer one, because the real `syncAccounts` call
pushes a whole portfolio's account list at once — see the diagram above. The Mikro `customerId` is
the QCobro account `externalId`, so repeated pushes are idempotent per row.

## Setting MANUAL tags

`risk:*` tags are set and cleared by humans, through:

- the **tRPC API** (a protected mutation), and
- the **CTL** command-line tool.

There is no dashboard UI for tags in v1. The tag engine treats `risk:*` as read-only input and
never modifies them.

## Open items

- **A portfolio with zero matching customers can't be cleared.** `syncAccounts` requires a
  non-empty `rows` array (`accountRowSchema`/`syncAccountsInputSchema` in `@qcobro/common`), so
  there's no way to express "this portfolio now has nobody in it" through this call. If every
  customer cures out of a portfolio, that portfolio is silently skipped and left as whatever it
  last successfully synced to.
- **Full pass on every payment.** The on-payment trigger re-runs the same full-base sync as the
  cron (see "Sync mechanics") rather than a narrower per-customer push, because the real API's
  batch/`REPLACE` semantics make a single-customer push unsafe. Fine at current volume; revisit
  if payment volume makes a full-base recompute per payment too expensive (track alongside
  "recompute at scale" below).
- **Recompute at scale** — every sync pass walks every active customer sequentially, fetching
  loans/last-payment per matching customer. Fine at current volume; daily-loan growth may need
  batching or only-recompute-changed.
- **Single vs multiple balances** — see the balance-basis section above; v1 pushes one
  `outstandingBalance` figure per `balanceBasis`.
