## MODIFIED Requirements

### Requirement: Statement includes the ledger health-check result

The loan-statement SHALL include the pass/fail health-check result from
`evaluateSnapshot` so the customer-facing document also proves the ledger is
internally consistent. The verification banner SHALL reflect whether all checks
passed. The banner SHALL NOT report a clean verification while the statement
displays a mora window whose collected amount exceeds the mora generated for it;
such a window SHALL appear as a failed control.

#### Scenario: Passing ledger shows a verified banner

- **WHEN** `evaluateSnapshot` reports no critical failures for the loan
- **THEN** the statement's verification banner indicates the ledger is
  consistent and the JSON carries the per-check results

#### Scenario: Failing check is surfaced, not hidden

- **WHEN** `evaluateSnapshot` reports a critical failure
- **THEN** the statement does not claim a clean verification and the failing
  check is present in the JSON

#### Scenario: Over-collected mora contradicts a clean banner

- **WHEN** the statement's mora KPI shows more mora collected than generated for
  the window
- **THEN** the verification banner reports a failed control rather than all
  controls passed, and the failing check is present in the JSON
