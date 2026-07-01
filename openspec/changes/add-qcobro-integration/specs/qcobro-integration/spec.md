## ADDED Requirements

### Requirement: QCobro integration is configured in mikro.json

The system SHALL read QCobro settings from a `qcobro` section in `mikro.json`, validated by a zod
schema in `@mikro/common`. The section SHALL provide `apiKey`, `apiSecret`, `workspace`, `syncMode`
(`APPEND_ONLY` | `UPDATE_EXISTING` | `REPLACE`), `balanceBasis` (`outstanding_with_mora` |
`outstanding_principal` | `past_due_amount` | `next_installment`), `schedule` (a cron expression),
and `portfolios` (an array of mapping rules). Invalid configuration SHALL fail validation with a
message identifying the offending field. Credentials SHALL be supplied via config and documented as
placeholders in `mikro.json.example`.

#### Scenario: Valid config loads

- **WHEN** `mikro.json` contains a well-formed `qcobro` section
- **THEN** the config loads and the integration is configured with those values

#### Scenario: Invalid syncMode rejected

- **WHEN** `qcobro.syncMode` is not one of the allowed values
- **THEN** config validation fails naming `qcobro.syncMode` and the allowed values

#### Scenario: Invalid cron schedule rejected

- **WHEN** `qcobro.schedule` is not a parseable cron expression
- **THEN** config validation fails naming `qcobro.schedule`

### Requirement: Portfolio membership is determined by declarative tag rules

The system SHALL determine, for each customer, the set of QCobro portfolios it belongs to by
evaluating each `qcobro.portfolios[]` rule against the customer's tags. Each rule has a target
portfolio `id` and a `match` object with optional `all`, `any`, and `none` tag lists, combined
with AND: `all` requires every listed tag present, `any` requires at least one present, `none`
requires none present. A customer MAY match multiple portfolios.

#### Scenario: Match with exclusion

- **WHEN** a rule is `{ any: ["dpd:8_30","dpd:31_60"], none: ["risk:premium","risk:do_not_contact"] }`
  and a customer has `dpd:8_30` and `risk:premium`
- **THEN** the customer does NOT match that portfolio (excluded by `none`)

#### Scenario: Consent gate

- **WHEN** a customer has `risk:do_not_contact` and every portfolio rule lists it under `none`
- **THEN** the customer matches no portfolio and is not contacted

#### Scenario: Multiple portfolios

- **WHEN** a customer satisfies two different portfolio rules
- **THEN** the customer is a member of both target portfolios

### Requirement: Mikro pushes portfolio membership to QCobro one direction

The system SHALL synchronize portfolio membership to QCobro using `@qcobro/sdk`, upserting an account
keyed by `externalId = Mikro customerId`, and adding/removing the account's portfolio memberships to
match the evaluated target set. The sync SHALL diff the target set against the last-synced set for
that customer and apply only the difference. The sync SHALL respect `qcobro.syncMode`. Mikro SHALL
NOT read membership back from QCobro as a source of truth.

#### Scenario: Account upserted idempotently

- **WHEN** a customer is synced twice with no tag change
- **THEN** the QCobro account is upserted under the same `externalId`
- **AND** no redundant membership changes are sent on the second sync

#### Scenario: Membership removed when tags improve

- **WHEN** a customer previously in `ptf_123` no longer matches its rule after curing
- **THEN** the sync removes the account from `ptf_123`

### Requirement: The pushed account balance follows balanceBasis

The system SHALL set the QCobro account `balance` to the figure selected by `qcobro.balanceBasis`,
computed across the customer's relevant loans: `outstanding_with_mora` (remaining principal plus
accrued mora), `outstanding_principal` (remaining principal only), `past_due_amount` (overdue
installments plus their mora — the cure amount), or `next_installment` (the next payment due).

#### Scenario: Cure amount pushed

- **WHEN** `balanceBasis` is `past_due_amount` and a customer owes 1,300 overdue plus 200 mora
- **THEN** the QCobro account `balance` is 1,500

#### Scenario: Full payoff pushed

- **WHEN** `balanceBasis` is `outstanding_with_mora` and the customer's remaining principal is 6,000
  with 200 mora accrued
- **THEN** the QCobro account `balance` is 6,200

### Requirement: Sync runs on payment and on a cron schedule

The system SHALL trigger tag recompute and QCobro sync (a) inline when a payment is recorded, for
the affected customer, and (b) on the cron `qcobro.schedule`, recomputing days-past-due/status across
customers and re-syncing. The cron schedule SHALL be evaluated in the configured `timezone`.

#### Scenario: Payment triggers immediate sync

- **WHEN** a payment is recorded for a customer
- **THEN** that customer's tags are recomputed and synced to QCobro without waiting for the cron

#### Scenario: Scheduled deterioration sync

- **WHEN** the cron schedule fires and a previously `current` customer has become past due by the
  passage of time
- **THEN** the customer is retagged `status:past_due` with the appropriate `dpd:` bucket and synced
  into the matching portfolio
