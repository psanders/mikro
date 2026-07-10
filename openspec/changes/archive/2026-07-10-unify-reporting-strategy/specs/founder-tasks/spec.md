## ADDED Requirements

### Requirement: Loan-statement automation in the catalog

The automation catalog SHALL register a `loan-statement` automation that generates the loan-statement report (JSON + branded PDF) for a given loan. Its param spec SHALL declare the loan id as a slot (a `static` slot for a scheduled task, an `ask` slot for on-demand invocation) validated against the loan-statement report's input schema. Executing the automation SHALL generate the report through the shared loan-statement report definition — it SHALL NOT reimplement statement generation — and SHALL be read-only with respect to loan and ledger data (it produces a document, it does not mutate the ledger). It SHALL follow the same registration, gating, and execution conventions as the existing automations (`pay-collector`, `record-expense`, `daily-close`).

#### Scenario: Loan-statement automation is registered

- **WHEN** the automation catalog is enumerated
- **THEN** a `loan-statement` automation is present with a loan-id slot and a param spec that validates against the loan-statement report's input schema

#### Scenario: Executing the automation generates a statement

- **WHEN** the `loan-statement` automation executes with a valid loan id
- **THEN** the loan-statement report is generated via the shared report definition and returned, with no mutation to the loan or its payment ledger

#### Scenario: Invalid loan id is rejected before generation

- **WHEN** the automation is invoked with a loan id that fails the report's input schema
- **THEN** a structured validation error is returned and no document is produced
