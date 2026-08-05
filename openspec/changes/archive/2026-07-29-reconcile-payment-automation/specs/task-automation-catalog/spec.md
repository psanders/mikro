# task-automation-catalog — delta

## MODIFIED Requirements

### Requirement: Automations are a closed, code-defined catalog

The task system SHALL execute only automations registered in a code catalog shipped with the apiserver. Each automation declares: a unique `id`, a Spanish display title, a gate floor (`auto` | `confirm`), a param spec assigning every slot a Zod type and a source (`static` | `computed` | `ask`), and a deterministic `execute` function with dependency-injected services. There SHALL be no API surface for defining, uploading, or modifying automations at runtime, and payloads SHALL be re-validated against the automation's current param schema at fire time and at confirm time — a mismatch moves the firing to `NEEDS_INPUT` with an explanation rather than crashing or executing.

An `ask` slot MAY additionally declare `defaultFrom`, naming another field of the gathered payload whose value pre-fills that slot's confirm-time input. The prefill SHALL be a suggestion only: the input remains freely editable and the supplied value is validated against the slot's schema like any other ask value, so a prefilled slot never bypasses the automation's gate. If the named field is absent from the payload, or holds a value that is neither a number nor a string, the slot SHALL render with no prefill rather than an empty-string or `undefined` artifact. `defaultFrom` SHALL be exposed on the slot descriptor the catalog publishes to clients, so the prefill is applied by the client from the descriptor and is not special-cased per automation.

#### Scenario: Unknown automation cannot be bound

- **WHEN** a task creation names an `automationId` not present in the catalog
- **THEN** the creation is rejected with a structured error

#### Scenario: Schema drift degrades safely

- **WHEN** a firing's stored payload no longer satisfies the automation's current param schema (the automation was updated between fire and confirm)
- **THEN** the firing moves to `NEEDS_INPUT` explaining the mismatch, and nothing executes

#### Scenario: Ask slot pre-fills from its declared source field

- **WHEN** a firing is presented for confirmation and its automation declares an `ask` slot with `defaultFrom` naming a payload field that holds a number
- **THEN** that slot's input renders pre-filled with the value, the founder may edit or replace it, and the value the founder submits is the one validated and executed

#### Scenario: Missing source field yields no prefill

- **WHEN** a firing's `defaultFrom` source field was left unset at task creation
- **THEN** the slot's input renders empty and confirmation still requires a schema-valid value for it

### Requirement: payment automation records a payment to an employee or third party

The catalog SHALL include `payment` with gate floor `confirm`, superseding the retired `pay-collector` id (the rename and its `collectorId` → `employeeId` slot rename are backfilled for any pre-existing `Task`/`TaskFiring` row). Slots: `employeeId` (static, **optional** — free-standing payments such as salaries or provider invoices need no employee), `accountId` and `categoryId` (static, required), `suggestedAmount` (static, optional, positive, bounded); `amount` (ask, positive, bounded, `defaultFrom: "suggestedAmount"`); `note` (ask, optional).

`suggestedAmount` SHALL pin nothing: it seeds the confirm-time `amount` input for recurring fixed-amount payments while leaving `amount` a required, editable, founder-supplied ask value. Leaving `suggestedAmount` unset SHALL be valid and SHALL produce no prefill.

The confirm card context SHALL include the configured employee's name and the current week's collected total **only when that employee actually holds the `COLLECTOR` role**; for any other employee, or when no employee is configured, the automation SHALL contribute no context rather than render a misleading zero-collection sentence. This context is display-only and never a source of the amount. Execute SHALL create an expense `AccountingTransaction` from the configured account via the existing accounting service and succeed or fail atomically, describing the transaction with the founder's note when supplied and falling back to the employee's name when not.

#### Scenario: Confirmed payment posts a transaction

- **WHEN** a founder confirms a `payment` firing with amount 3500
- **THEN** an expense transaction of 3500 exists on the configured account, attributed to the founder

#### Scenario: Suggested amount pre-fills the confirm input

- **WHEN** a founder confirms a `payment` firing for a task created with `suggestedAmount` 3500
- **THEN** the card's amount input is pre-filled with 3500, the founder may change it before confirming, and the amount actually confirmed is the one posted

#### Scenario: Weekly context is shown but not binding

- **WHEN** a `payment` firing whose configured employee holds the `COLLECTOR` role is presented for confirmation
- **THEN** the card shows that collector's week collected total while the amount field remains founder-supplied

#### Scenario: Non-collector payment renders no collection context

- **WHEN** a `payment` firing's configured employee does not hold the `COLLECTOR` role, or no employee is configured
- **THEN** the card shows no week-collected sentence and confirmation still posts the expense normally

#### Scenario: Payment without an employee is valid

- **WHEN** a founder creates and confirms a `payment` task with no `employeeId` — a provider invoice
- **THEN** the task is accepted, the expense posts to the configured account, and the transaction description falls back to the founder's note or a generic payment label
