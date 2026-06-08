## 1. Reconcile designs to code + shell wiring

- [x] 1.1 Read the real return shapes: the `AccountingAccount` / `AccountingCategory` / `AccountingTransaction` models and the `accounting.listTransactions` / `getTransaction` / `listAccounts` / `listCategories` / `createTransaction` / `reverseTransaction` / `getTransactionAttachment` implementations; note exactly which fields/relations each returns
- [x] 1.2 Audit Pencil frame `y3c8Wl` (Contabilidad) against those shapes; edit the `.pen` design (pencil MCP tools) to drop fields the API doesn't return and reflect the ones it does — code wins on every conflict
- [x] 1.3 Add `lib/accounting.ts`: `TYPE_TABS` (TransactionType → Spanish label), `typeMeta`/`statusMeta`/`accountKindMeta` (label + Badge tone), and a default date-range helper
- [x] 1.4 Add routes `/contabilidad` and `/contabilidad/:id` under the auth guard in `src/App.tsx`, importing the two new pages
- [x] 1.5 Activate the "Contabilidad" nav entry in `Layout.tsx` (`to: "/contabilidad"`, active on `/contabilidad` routes)

## 2. Contabilidad ledger screen (Pencil y3c8Wl)

- [x] 2.1 Screenshot + read the reconciled Pencil frame `y3c8Wl` and use it as the layout reference
- [x] 2.2 Build `ContabilidadPage.tsx` shell: `PageHeader` ("Contabilidad" + subtitle), the accounts balance strip from `accounting.listAccounts` (name, kind, `currentBalance`), a type `Tab` strip, and a "Registrar transacción" trigger
- [x] 2.3 Fetch `trpc.accounting.listTransactions.useQuery({ startDate, endDate, type?, accountId?, categoryId?, includeReversed?, limit, offset })`; manage date-range, `type`, account/category filters, `includeReversed`, and page state
- [x] 2.4 Build the table with model-derived columns: fecha (`occurredAt`), tipo (`type` badge), cuenta (`account.name`, `→ toAccount.name` for transfers), categoría (`category.name`), descripción/vendor, monto (`amount`), estado (`status` badge), adjuntos (`_count.attachments`); row click → `/contabilidad/:id`
- [x] 2.5 Account/category filter selects (from `listAccounts`/`listCategories`) and the "incluir reversadas" toggle
- [x] 2.6 Loading / error / empty states; "Cargar más" pagination (`limit`/`offset`, append)
- [x] 2.7 Build the "Registrar transacción" form (`accounting.createTransaction`): type, account select, amount, occurredAt, description, vendor, reference; reveal a required distinct destination account for TRANSFER; reveal a kind-filtered category select for EXPENSE/INCOME; hide both otherwise; invalidate ledger + accounts on success; surface server validation errors

## 3. Transacción detail screen (/contabilidad/:id)

- [x] 3.1 Build `TransaccionDetailPage.tsx`: fetch `trpc.accounting.getTransaction.useQuery({ id })` (id from `useParams`); header (type + amount + status badge); back link; loading / error / not-found
- [x] 3.2 Detail `SectionCard`s with the real fields: tipo, estado, monto, fecha, descripción, vendor, referencia, and linked cuenta / cuenta destino (transfers) / categoría / registrado por (`createdBy.name`)
- [x] 3.3 Attachments section: list from the transaction's attachments; view/download each via `accounting.getTransactionAttachment`; empty-state when none
- [x] 3.4 Reverse action (`accounting.reverseTransaction`, optional notes) shown only when `status === "POSTED"`; invalidate `getTransaction` + ledger after reverse

## 4. Verify

- [x] 4.1 `npm run typecheck` + `npm run build -w @mikro/dashboard` clean
- [ ] 4.2 Against the running apiserver with a login: ledger loads for the date range, type tabs + account/category filters + incluir-reversadas work, pagination appends
- [ ] 4.3 Register a transaction of each shape (deposit/expense/income/transfer) respecting the cross-field rules; from the detail, reverse a POSTED transaction and view an attachment
- [ ] 4.4 Visual diff ledger vs reconciled Pencil `y3c8Wl`
<!-- 4.2-4.4 require a running apiserver with seeded data — to be verified manually -->
