## Why

The ops dashboard now has Inicio, Solicitudes, and Clientes wired up, but the "Contabilidad" nav item is still inert — the full accounting backend (accounts, categories, a posted/reversed transaction ledger) exists and is exercised elsewhere, yet ops staff have no screen to see balances, browse the ledger, register a transaction, or reverse one. This is Phase 6: make accounting operable, reusing the patterns from the Clientes screens. No backend work is needed.

**Source of truth: the code.** The screens render what the `accounting.*` procedures actually return. The Pencil frame `y3c8Wl` is the layout/styling reference, but where it shows fields or shapes that don't match the real data model, the **Pencil design is updated to match the code** — not the reverse.

## What Changes

- **Contabilidad ledger** (`/contabilidad`, Pencil `y3c8Wl`) — wired to `accounting.listTransactions` (requires a `startDate`/`endDate` range): an accounts balance strip from `accounting.listAccounts` (name, kind, `currentBalance`); type-filter tabs (Todas / Depósito / Retiro / Gasto / Ingreso / Transferencia over the `TransactionType` enum), optional account and category filters, an "incluir reversadas" toggle (`includeReversed`), and `limit`/`offset` pagination; a table whose columns come from the real return shape (`occurredAt`, `type`, `account.name`, `toAccount.name` for transfers, `category.name`, `description`/`vendor`, `amount`, `status`, attachment count from `_count.attachments`); row → detail; loading/error/empty; and a **"Registrar transacción"** form (`accounting.createTransaction`) honoring the cross-field rules (TRANSFER requires `toAccountId` ≠ `accountId`; `categoryId` only for EXPENSE/INCOME), with account/category selects from `listAccounts`/`listCategories`. Queries invalidate after create.
- **Transacción detail** (`/contabilidad/:id`, Pencil-derived) — wired to `accounting.getTransaction`: all returned fields plus the linked account / toAccount / category / createdBy, an attachments list (view/download via `accounting.getTransactionAttachment`), and a **reverse** action (`accounting.reverseTransaction` with optional notes) shown only while `status` is `POSTED`. Queries invalidate after reverse.
- **Shell wiring** — activate the "Contabilidad" nav entry and add `/contabilidad` + `/contabilidad/:id` routes under the auth guard.
- **Pencil reconciliation** — audit `y3c8Wl` against the `AccountingTransaction`/`AccountingAccount`/`AccountingCategory` models and the procedure return types; edit the `.pen` design so it reflects the code.

## Capabilities

### New Capabilities

- `contabilidad-ledger`: The accounting ledger screen — accounts balance strip, transactions table with type/account/category/date filters and pagination, and the register-transaction form
- `contabilidad-transaction-detail`: The transaction detail screen — full transaction with linked records and attachments, plus the reverse action

### Modified Capabilities

- `ops-dashboard-shell`: The Contabilidad nav becomes active and `/contabilidad` + `/contabilidad/:id` routes are added under the auth guard

## Impact

- `mods/dashboard/src/pages/` — new `ContabilidadPage.tsx` + `TransaccionDetailPage.tsx`
- `mods/dashboard/src/App.tsx` — routes for `/contabilidad` and `/contabilidad/:id` under the auth guard
- `mods/dashboard/src/components/Layout.tsx` — activate the Contabilidad nav entry (`to: "/contabilidad"`)
- `mods/dashboard/src/lib/` — an `accounting.ts` display helper (type/status/kind labels, segment tabs, date-range helper)
- `pencil.pen` — frame `y3c8Wl` reconciled to the code (design follows code)
- No backend changes — `accounting.listTransactions`, `getTransaction`, `listAccounts`, `listCategories`, `createTransaction`, `reverseTransaction`, `getTransactionAttachment` already exist on the protected router (`protectedProcedure`, nested under `accounting.*`)
- Reuses the dashboard components and query patterns from `add-clientes-dashboard` (`PageHeader`, `Search`, `Tab`, `Badge` with the `dot` prop, `SectionCard`, `SummaryCard`, `Field`, `Button`, pagination)
- Out of scope: managing accounts and categories (`createAccount`/`updateAccount`/`createCategory`), the accounting PDF report (`generateAccountingReport`), and the Préstamos / Reportes screens
