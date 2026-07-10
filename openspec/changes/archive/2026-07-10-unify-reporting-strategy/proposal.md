## Why

Report generation is scattered across surfaces (CLI, dashboards, WhatsApp copilot) with inconsistent, duplicated logic and a spread of output formats (PNG via satori, Excel via exceljs, CSV, ad hoc PDF). Issue #110 calls for one shared reporting module standardized on JSON + PDF. Resolving the loan #10036 payment dispute (ex-#161) took ~an hour of throwaway scripting to hand-derive a per-cuota schedule and hand-build a branded PDF — work that recurs every dispute. This change lays the shared foundation and lands that loan-statement as the first report, proving the pattern before the broader migration.

## What Changes

- Add a shared `Report` contract in `@mikro/common` that turns a typed report data model into both a JSON payload and a branded PDF, so every entry point uses one module with no duplicated generation logic.
- Add a unified branded PDF renderer built on the existing receipts font/satori pipeline (`mods/common/src/receipts/`), encoding the issue #161 look/feel: brand header, verification badge, summary KPI cards, status-pill data table, and an optional secondary ledger page. Uses Mikro brand tokens and Inter.
- Add two tested helpers: a FIFO waterfall-allocation helper (money applied to cuota _N_ once cumulative paid ≥ _N_ × cuota amount) and a repayment-schedule builder (due date + coverage date + status + amount), reusing `getDueDateForCycle` and `buildLoanSnapshot`/`evaluateSnapshot` — no ad hoc reimplementation.
- Add a loan-statement report on the foundation: JSON + a branded 2-page PDF (page 1: header/verification badge/KPI cards/schedule with status pills; page 2: raw payment ledger + reversed-entry note) from a loan snapshot + schedule + health-check result. The health result is included so the customer-facing document also proves the ledger is consistent.
- Expose the loan-statement as a founder-feed automation-catalog action (same pattern as `pay-collector`/`record-expense`/`daily-close`) and a CLI command, both producing equivalent output.

Scope (expanded 2026-07-10): this change now delivers the full #110 consolidation. In addition to the foundation + loan-statement, it migrates the other five Pencil-designed reports (performance, customers, defaulted, renewal, accounting) onto the shared `Report` contract as **JSON + PDF**, and **retires/deletes every other report-generation path**: the satori→PNG report generators, all Excel (`exceljs`) exports including the WhatsApp-copilot report tools and customer-list exports, and WhatsApp report delivery. End state: the only reports are the six designed in Pencil, each available as JSON and branded PDF, from one shared module across CLI, dashboard, and copilot. (Two adjacent items are intentionally left for owner review, not deleted blind: the audit-log CSV export and `generateModeloReport` — see the morning note.)

## Capabilities

### New Capabilities

- `reporting-foundation`: the shared `Report` contract (typed data model → JSON + branded PDF), the unified #161-style PDF renderer on the receipts pipeline, and the tested waterfall-allocation + repayment-schedule helpers.
- `loan-statement-report`: a per-loan statement report producing JSON and a branded 2-page PDF, exposed via a founder-feed automation-catalog action and a CLI command.

### Modified Capabilities

- `founder-tasks`: the automation catalog gains a loan-statement action that generates and returns the loan-statement PDF/JSON for a given loan.
- `founder-reports`: report entry points standardize on JSON + PDF; non-JSON/PDF report formats (PNG, Excel) are removed and the catalog reflects the migrated reports.

## Impact

- **`@mikro/common`**: new `reports` foundation module + helpers; reuses `receipts/` fonts and `eval/` snapshot; brand tokens from `receipts/receipt-layout.ts`.
- **`mods/apiserver`**: loan-statement report data builder + transport (tRPC) for the founder-feed action.
- **`mods/dashboard`**: founder-feed automation-catalog action wiring (Storybook-first for any new card).
- **`mods/ctl`**: new CLI report command.
- **Dependencies**: no new deps expected (satori/sharp/pdfkit already in `@mikro/common`); no format retirement in this change.
- **Design**: `pencil.pen` gains PDF representations for all six reports (AC#1).
