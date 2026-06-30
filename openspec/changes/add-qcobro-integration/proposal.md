## Why

Mikro originates and services micro-loans but has no automated outbound collections. QCobro
(https://docs.qcobro.com) is an AI-voice collections platform that contacts debtors over voice,
SMS, email, and WhatsApp and runs campaigns against **portfolios** of accounts. To use it, someone
must decide _which_ borrowers belong in _which_ portfolio and keep that membership current as
borrowers fall behind or catch up. Today that mapping does not exist, and Mikro has no concept of
account tags, delinquency buckets, or contact consent.

This change makes Mikro the source of truth for portfolio membership: it derives a standard
delinquency taxonomy from loan/payment state, lets ops assert manual relationship/consent tags,
maps tags to QCobro portfolios via declarative rules in `mikro.json`, and pushes membership +
balances into QCobro. Design reference: `QCOBRO.md` at the repo root.

## What Changes

- **Customer tags (hybrid).** A new `CustomerTag` store on the customer holds tags with a
  `source` of `AUTO` or `MANUAL`. AUTO tags are owned and recomputed by a tag engine; MANUAL
  tags are asserted by humans and never touched by the engine.
- **Two-axis AUTO taxonomy.** The engine derives, per customer, one `status:` lifecycle tag
  (`new`, `current`, `pre_mora`, `past_due`, `defaulted`, `written_off`, `completed`) and, when
  delinquent, one `dpd:` aging bucket (`1_7`, `8_30`, `31_60`, `61_90`, `91_180`, `180_plus`).
  Derivation uses the **worst loan** across the customer's loans. `status:defaulted` is **ops-driven**:
  the engine trusts Mikro's `Loan.status === DEFAULTED` and never infers default from DPD.
- **MANUAL `risk:` tags via API + CTL only.** `risk:premium`, `risk:do_not_contact`,
  `risk:in_negotiation`, `risk:payment_plan`, etc. are set/cleared through a protected tRPC mutation
  and a `mikro` CLI command. No dashboard UI in v1.
- **`qcobro` config section** in `mikro.json` (zod-validated in `@mikro/common`): `apiKey`,
  `apiSecret`, `workspace`, `syncMode`, `balanceBasis`, `schedule` (cron), and `portfolios[]`
  mapping rules. Secrets ship as placeholders.
- **Declarative portfolio rules.** Each `portfolios[]` entry maps a tag predicate
  (`all` / `any` / `none` over tags) to a QCobro portfolio id. `risk:do_not_contact` under `none`
  is the global consent gate.
- **Sync service** (`@qcobro/sdk`) pushes one direction only. It recomputes tags, evaluates rules
  to a target portfolio set, diffs against the last-synced set, and upserts the QCobro account
  (`externalId = customerId`), adding/removing portfolio memberships and pushing `balance` per
  `balanceBasis`.
- **Two sync triggers.** On-payment (inline — payments can cure an account to `current`) and a cron
  job on `qcobro.schedule` (recomputes DPD/status as time passes and re-syncs). This adds a
  cron-capable scheduler (e.g. `croner`); the existing follow-up worker is interval-based.

## Capabilities

### New Capabilities

- `customer-tags`: hybrid AUTO/MANUAL tags on a customer, the two-axis AUTO taxonomy and its
  worst-loan derivation, and the API/CTL surface for MANUAL tags.
- `qcobro-integration`: the `qcobro` config section, declarative portfolio mapping rules, the
  one-direction sync (account upsert, portfolio membership diff, balance basis), and the on-payment
  - cron triggers.

### Modified Capabilities

<!-- No existing documented requirement changes. The sync hooks into payment creation but does not
alter payment/mora behavior. -->

## Impact

- **DB**: new tag storage (a `CustomerTag` table — tag, source, setAt — related to `Customer`)
  plus a per-customer last-synced portfolio set for diffing. Prisma migration required.
- **Config**: `mikro.json` gains a `qcobro` section; `mikro.json.example` documents placeholders.
  `@mikro/common` config schema gains the `qcobro` zod schema. New `croner` (or equivalent) dep for
  cron scheduling; `@qcobro/sdk` added to `@mikro/apiserver`.
- **Code**: tag engine + sync service in `@mikro/apiserver`; on-payment hook in
  `createCreatePayment`; cron worker started in `index.ts`; tRPC mutation for MANUAL tags;
  `mikro` CLI command for MANUAL tags.
- **Ops**: operators configure credentials, `schedule`, `balanceBasis`, and `portfolios[]` rules in
  `mikro.json`; manage `risk:` tags via CLI/API. No QCobro→Mikro write-back in this change.
- **Out of scope (v1)**: dashboard UI for tags; ingesting QCobro interaction outcomes back into
  Mikro; multiple simultaneous balance figures per account.
