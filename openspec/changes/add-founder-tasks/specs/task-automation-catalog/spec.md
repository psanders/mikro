## ADDED Requirements

### Requirement: Automations are a closed, code-defined catalog

The task system SHALL execute only automations registered in a code catalog shipped with the apiserver. Each automation declares: a unique `id`, a Spanish display title, a gate floor (`auto` | `confirm`), a param spec assigning every slot a Zod type and a source (`static` | `computed` | `ask`), and a deterministic `execute` function with dependency-injected services. There SHALL be no API surface for defining, uploading, or modifying automations at runtime, and payloads SHALL be re-validated against the automation's current param schema at fire time and at confirm time — a mismatch moves the firing to `NEEDS_INPUT` with an explanation rather than crashing or executing.

#### Scenario: Unknown automation cannot be bound

- **WHEN** a task creation names an `automationId` not present in the catalog
- **THEN** the creation is rejected with a structured error

#### Scenario: Schema drift degrades safely

- **WHEN** a firing's stored payload no longer satisfies the automation's current param schema (the automation was updated between fire and confirm)
- **THEN** the firing moves to `NEEDS_INPUT` explaining the mismatch, and nothing executes

### Requirement: pay-collector automation records a collector payment

The catalog SHALL include `pay-collector` with gate floor `confirm`. Slots: `collectorId`, `accountId`, `categoryId` (static); `amount` (ask, positive, bounded); `note` (ask, optional). Its confirm card context SHALL include the collector's name and the current week's collected total for that collector (computed, display-only — it does not prefill the amount). Execute SHALL create an expense `AccountingTransaction` from the configured account via the existing accounting service and succeed or fail atomically.

#### Scenario: Confirmed payment posts a transaction

- **WHEN** a founder confirms a `pay-collector` firing with amount 3500
- **THEN** an expense transaction of 3500 exists on the configured account, attributed to the founder

#### Scenario: Weekly context is shown but not binding

- **WHEN** a `pay-collector` firing is presented for confirmation
- **THEN** the card shows the collector's week collected total while the amount field remains founder-supplied

### Requirement: daily-close automation bridges the day's collections into the ledger

The catalog SHALL include `daily-close` with gate floor `confirm`. Slots: `closeDate` (computed: the previous business day); `accountId` (static). Execute SHALL sum the close date's collected loan `Payment` rows, grouped per payment method, and post the bridging deposit transaction(s) to the configured ledger account. Execution MUST be idempotent per close date: if that date was already bridged, execute SHALL refuse with a clear reason (surfaced as `task.failed`) and post nothing.

#### Scenario: Close posts the day's bridge

- **WHEN** a founder confirms a `daily-close` firing for a date with collected payments
- **THEN** deposit transactions matching the day's per-method collected totals exist on the ledger account

#### Scenario: Double close is refused

- **WHEN** a `daily-close` firing is confirmed for a date already bridged
- **THEN** no transaction is posted and the firing records `task.failed` with a reason naming the prior close

#### Scenario: Empty day closes without posting

- **WHEN** a `daily-close` firing is confirmed for a date with no collected payments
- **THEN** no transaction is posted and the firing completes successfully noting a zero day
