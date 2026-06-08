# contabilidad-ledger Specification

## Purpose

The accounting ledger screen (`/contabilidad`) provides operators with a real-time view of account balances and a filterable, paginated transaction history, along with the ability to register new transactions.

## Requirements

### Requirement: Accounts balance strip

The `/contabilidad` screen SHALL show a balance strip built from `accounting.listAccounts`, rendering each account's name, kind, and `currentBalance` from the returned `AccountingAccount` fields.

#### Scenario: Accounts render

- **WHEN** an authenticated operator opens `/contabilidad`
- **THEN** `accounting.listAccounts` is queried and each account is shown with its name, kind, and current balance

#### Scenario: No accounts

- **WHEN** there are no accounts
- **THEN** the strip shows an empty-state rather than a broken layout

### Requirement: Transactions ledger

The screen SHALL list transactions from `accounting.listTransactions` over a `startDate`/`endDate` range, rendering columns drawn from the real return shape: `occurredAt`, `type`, `account.name` (and `toAccount.name` for transfers), `category.name`, `description`/`vendor`, `amount`, `status`, and the attachment count from `_count.attachments`.

#### Scenario: Ledger loads and renders

- **WHEN** the operator opens `/contabilidad`
- **THEN** transactions for the active date range are fetched and rendered one row each with the documented columns

#### Scenario: Loading, error, empty states

- **WHEN** the query is loading, fails, or returns no rows
- **THEN** the screen shows a loading indicator, an error message, or an empty-state respectively

#### Scenario: Row opens the detail

- **WHEN** the operator clicks a transaction row
- **THEN** the app navigates to `/contabilidad/:id` for that transaction

### Requirement: Ledger filtering

The ledger SHALL provide type-filter tabs over the `TransactionType` enum (Todas / Depósito / Retiro / Gasto / Ingreso / Transferencia), optional account and category filters, and an "incluir reversadas" toggle that drives `includeReversed`.

#### Scenario: Type tab filters

- **WHEN** the operator selects a type tab
- **THEN** the list is re-queried with that `type` and shows only matching transactions

#### Scenario: Account or category filter

- **WHEN** the operator selects an account or category filter
- **THEN** the list is re-queried with `accountId`/`categoryId` and narrows accordingly

#### Scenario: Include reversed toggle

- **WHEN** the operator enables "incluir reversadas"
- **THEN** the query sends `includeReversed: true` and REVERSED transactions appear; otherwise only POSTED transactions are shown

### Requirement: Ledger pagination

The ledger SHALL support loading additional pages via a "Cargar más" control using `limit`/`offset`, appending the next page.

#### Scenario: Load more appends

- **WHEN** a full page was returned and the operator clicks "Cargar más"
- **THEN** the next page is fetched with an increased `offset` and appended

### Requirement: Register transaction

The screen SHALL provide a "Registrar transacción" form wired to `accounting.createTransaction`, with account and category selects sourced from `listAccounts`/`listCategories`, plus `type`, `amount`, `occurredAt`, `description`, `vendor`, and `reference`. The form MUST enforce the backend cross-field rules in the UI: a TRANSFER requires a `toAccountId` different from `accountId`; `toAccountId` is only allowed for TRANSFER; and `categoryId` is only allowed for EXPENSE or INCOME.

#### Scenario: Create a transaction

- **WHEN** the operator submits a valid transaction
- **THEN** `accounting.createTransaction` is called and, on success, the ledger (and accounts strip) are invalidated and refreshed

#### Scenario: Transfer requires a distinct destination account

- **WHEN** the type is TRANSFER
- **THEN** the form requires a destination account that differs from the source account before it can be submitted

#### Scenario: Category restricted to expense/income

- **WHEN** the type is not EXPENSE or INCOME
- **THEN** the category selection is disabled or cleared so no `categoryId` is sent

#### Scenario: Server validation error is surfaced

- **WHEN** `createTransaction` returns a validation error
- **THEN** the form shows the error and does not clear the operator's input
