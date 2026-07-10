## ADDED Requirements

### Requirement: Loan-statement report renders JSON and a branded PDF

The system SHALL provide a loan-statement report, built on the reporting foundation, that takes a loan id and produces both a JSON payload and a branded 2-page PDF. The report data model SHALL be derived from `buildLoanSnapshot`, the repayment-schedule builder, and `evaluateSnapshot` — not recomputed. Page 1 SHALL contain the brand header, a verification banner reflecting the health-check result, the summary KPI grid (capital, interés, total a pagar, abonado, saldo pendiente, mora, días de atraso, ciclos atrasados — bad-news values emphasized), and the repayment schedule as a status-pill table (per-cuota due date, estado, coverage-with-delta, monto and applied). Page 2 SHALL list the received (non-reversed) payments with method and a reconciliation note that explains any reversed/consolidated entries and reconciles the totals.

#### Scenario: Statement renders for a loan

- **WHEN** the report is generated for an existing loan id
- **THEN** a JSON payload and a 2-page branded PDF are produced from the loan's snapshot, schedule, and health-check result

#### Scenario: Reversed entries are excluded from the ledger and explained in the note

- **WHEN** the loan's ledger contains reversed payment rows
- **THEN** those rows are excluded from the page-2 received-payments table and the reconciliation note explains they were reversed/consolidated (money neither lost nor double-counted)

#### Scenario: Unknown loan is rejected

- **WHEN** the report is requested for a loan id that does not exist
- **THEN** a structured error is returned and no document is produced

### Requirement: Statement includes the ledger health-check result

The loan-statement SHALL include the pass/fail health-check result from `evaluateSnapshot` so the customer-facing document also proves the ledger is internally consistent. The verification banner SHALL reflect whether all checks passed.

#### Scenario: Passing ledger shows a verified banner

- **WHEN** `evaluateSnapshot` reports no critical failures for the loan
- **THEN** the statement's verification banner indicates the ledger is consistent and the JSON carries the per-check results

#### Scenario: Failing check is surfaced, not hidden

- **WHEN** `evaluateSnapshot` reports a critical failure
- **THEN** the statement does not claim a clean verification and the failing check is present in the JSON

### Requirement: Statement is available from the founder feed and the CLI with equivalent output

The loan-statement SHALL be exposed as a founder-feed automation-catalog action (admin/founder only) and as a CLI command, both invoking the same report definition so that, for the same loan and format, the CLI and the founder-feed action produce equivalent output.

#### Scenario: Founder-feed action generates a statement

- **WHEN** a founder invokes the loan-statement action for a loan id
- **THEN** the statement PDF/JSON is generated and returned through the founder surface

#### Scenario: CLI produces the same statement

- **WHEN** the CLI loan-statement command runs for the same loan id and format
- **THEN** it produces output equivalent to the founder-feed action for that loan and format

#### Scenario: Non-admin invocation is rejected

- **WHEN** an authenticated user without the ADMIN/founder role invokes the founder-feed action
- **THEN** the request is rejected with an authorization error
