# Tasks — QCobro Integration

## 1. Config schema

- [x] 1.1 Add `qcobroSchema` (apiKey, apiSecret, workspace, syncMode enum, balanceBasis enum, `schedule` cron string, `portfolios[]` with `id` + `match` {all,any,none}) to `mods/common/src/config.ts`; wire into `mikroConfigSchema` (`.strict()`).
- [x] 1.2 Validate `schedule` parses as a cron expression; validate `portfolios[].match` tag strings. (Config-load time does a 5-field shape check; `croner` does full semantic validation when the worker starts.)
- [x] 1.3 Add `qcobro` placeholder block to `mikro.json.example`.

## 2. Tag storage (DB)

- [x] 2.1 Add `CustomerTag` model (customerId, tag, source AUTO|MANUAL, setAt; unique on customerId+tag; index on tag) + relation on `Customer`. Add `TagSource` enum.
- [x] 2.2 Add per-customer last-synced portfolio set for diffing (JSON field on `Customer` or side table). (`Customer.lastSyncedPortfolios`)
- [x] 2.3 Prisma migration.

## 3. Tag engine

- [x] 3.1 Worst-loan aggregation: compute customer `status:` from loans (trust `Loan.status===DEFAULTED`; `pre_mora` from grace window).
- [x] 3.2 `dpd:` bucket from worst-loan calendar days past due (only when past_due/written_off).
- [x] 3.3 Idempotent reconcile: add/remove AUTO tags, never touch MANUAL.
- [x] 3.4 Unit tests for status/dpd boundaries and worst-loan selection. (`test/tags/createComputeCustomerTags.test.ts`, 12 cases covering every spec scenario)

## 4. Manual tags API + CLI

- [x] 4.1 Protected tRPC mutation to set/clear `risk:` tags (source=MANUAL).
- [x] 4.2 `mikro` CLI command (interactive + flags) for the same. (`customers:tags:set|clear|list`)

## 5. QCobro sync service

- [x] 5.1 Add QCobro client to `@mikro/apiserver`; client init from config. (`@qcobro/sdk` is not a published package — built an internal fetch-based client behind the same interface; auth mode is unconfirmed against the real API, see QCOBRO.md open items.)
- [x] 5.2 Evaluate `portfolios[]` rules over a customer's tags → target set.
- [x] 5.3 Diff target vs last-synced; upsert account (externalId=customerId), add/remove memberships, push `balance` per `balanceBasis`; respect `syncMode`; persist new last-synced set.
- [x] 5.4 Balance computation per basis across relevant loans.

## 6. Triggers

- [x] 6.1 On-payment: recompute + sync affected customer from `createCreatePayment` side effects.
- [x] 6.2 Cron worker (`croner`, config timezone) on `qcobro.schedule`: recompute base + sync; start/stop in `mods/apiserver/src/index.ts`.

## 7. Docs

- [x] 7.1 Keep `QCOBRO.md` in sync; flip its status note once shipped.
