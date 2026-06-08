## Context

The ops dashboard (`mods/dashboard`) is a React SPA. Inicio, Solicitudes, and Clientes are built; the Clientes change established the component vocabulary and the tRPC-query patterns, and the team standardized the `Badge` `dot` prop with neutral tones. The accounting backend is fully built: `accounting.*` procedures over `AccountingAccount`, `AccountingCategory`, and a `POSTED`/`REVERSED` `AccountingTransaction` ledger with transfers and attachments. This change wires the inert "Contabilidad" nav into a ledger + detail against that backend — no new procedures.

The governing constraint: **the code is the source of truth.** Screens render exactly what `accounting.listTransactions` / `getTransaction` / `listAccounts` / `listCategories` return. The Pencil frame `y3c8Wl` informs layout/styling; where it conflicts with the real model, the `.pen` design is edited to match the code.

## Goals / Non-Goals

**Goals:**

- A `/contabilidad` ledger: accounts balance strip, transactions table with type/account/category/date filters + pagination, and a register-transaction form.
- A `/contabilidad/:id` detail: full transaction with linked records and attachments, plus a reverse action.
- Reconcile the Pencil frame `y3c8Wl` to the actual model.
- Reuse the existing dashboard components and query patterns.

**Non-Goals:**

- Managing accounts/categories (`createAccount`/`updateAccount`/`createCategory`).
- The accounting PDF report (`generateAccountingReport`).
- The Préstamos / Reportes screens.

## Decisions

- **Date range is mandatory and operator-visible.** `listTransactions` requires `startDate`/`endDate`. The ledger defaults to a sensible window (e.g. the current month, or last 90 days) and exposes a range control, rather than hiding a hardcoded range. _Alternative:_ a fixed wide range like the payments list on the customer screen — acceptable as a fallback, but accounting users expect to scope by period, so the range is first-class here.

- **Type tabs map to the `TransactionType` enum; reversed is a toggle, not a tab.** Tabs are Todas / Depósito / Retiro / Gasto / Ingreso / Transferencia (`type` param). `status` (POSTED/REVERSED) is surfaced as an "incluir reversadas" toggle (`includeReversed`) because the default ledger view is POSTED-only. _Alternative:_ a status tab — rejected; `includeReversed` is additive, not a filter to one status.

- **The register form enforces the backend's cross-field rules in the UI.** TRANSFER reveals a required destination-account select (≠ source) and hides category; EXPENSE/INCOME reveal a category select (filtered by `listCategories({ kind })`); other types hide both. This mirrors `withTransactionRefinements` so the client doesn't post invalid combinations, but the server remains the authority and its errors are surfaced. _Alternative:_ a flat form that always shows every field — rejected; it would routinely produce server 400s.

- **Columns/fields derived from the return types.** `listTransactions` includes `account`/`toAccount`/`category`/`createdBy` (id+name) and `_count.attachments`, so the table can show names and an attachment indicator without extra queries. `getTransaction` returns the same relations. We render only those.

- **Mirror the Clientes file/route structure.** New pages `ContabilidadPage.tsx` + `TransaccionDetailPage.tsx`; a `lib/accounting.ts` display helper (type/status/kind labels, type tabs, date-range default); additive route entries in `App.tsx`; nav `to` in `Layout.tsx`. Small, isolated diff.

## Risks / Trade-offs

- [Pencil frame drifts from the model] → Reconcile `y3c8Wl` as an explicit task; code wins on conflict.
- [Register form's cross-field rules diverge from the server] → Encode them once in the form from the documented refinements and still surface server errors verbatim; do not duplicate validation logic loosely.
- [Empty accounts/categories make the form unusable] → The form requires an account; if none exist, show guidance pointing to account management (out of scope here) rather than a broken select.
- [Shared-file edits (`App.tsx`, `Layout.tsx`) collide with other sessions] → Edits are additive (one route block, one nav `to`); prior changes already finalized those files.
- [Money formatting/precision] → `amount`/balances are `Decimal` serialized as strings; reuse the existing `formatDop` helper and never do float math on them.
