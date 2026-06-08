## ADDED Requirements

### Requirement: Transaction detail screen

The dashboard SHALL provide a `/contabilidad/:id` screen that fetches a transaction via `accounting.getTransaction` (id from the route) and renders all returned fields (`type`, `status`, `amount`, `occurredAt`, `description`, `vendor`, `reference`) plus the linked `account`, `toAccount`, `category`, and `createdBy`. The screen MUST render only fields the procedure returns.

#### Scenario: Detail loads and renders

- **WHEN** an authenticated operator navigates to `/contabilidad/:id`
- **THEN** the transaction is fetched via `accounting.getTransaction` and its fields plus linked records are rendered

#### Scenario: Loading, error, not-found states

- **WHEN** the query is loading, fails, or returns no transaction for the id
- **THEN** the screen shows a loading indicator, an error message, or a not-found state respectively

#### Scenario: Transfer shows both accounts

- **WHEN** the transaction type is TRANSFER
- **THEN** both the source `account` and the destination `toAccount` are shown

### Requirement: Transaction attachments

The detail screen SHALL list the transaction's attachments and allow viewing/downloading each via `accounting.getTransactionAttachment`.

#### Scenario: Attachments listed and opened

- **WHEN** the transaction has attachments
- **THEN** they are listed and selecting one fetches its bytes via `getTransactionAttachment` and opens/downloads it

#### Scenario: No attachments

- **WHEN** the transaction has no attachments
- **THEN** the screen shows an empty-state for attachments

### Requirement: Reverse transaction

The detail screen SHALL offer a reverse action wired to `accounting.reverseTransaction` (with an optional notes field), shown only while the transaction `status` is `POSTED`.

#### Scenario: Reverse a posted transaction

- **WHEN** the operator reverses a POSTED transaction
- **THEN** `accounting.reverseTransaction` is called and, on success, the detail (and ledger) queries are invalidated and the transaction reflects REVERSED

#### Scenario: Reverse hidden when not posted

- **WHEN** the transaction status is already REVERSED
- **THEN** the reverse action is not shown
