## MODIFIED Requirements

### Requirement: Reviewers can edit an application's fields

The system SHALL provide an `updateApplication` mutation that merges a patch of editable fields into an application, re-derives its stable columns, recomputes its score, and persists — without changing status, assignment/decision fields, contract, or conversion fields. It SHALL be allowed only while the application is `IN_REVIEW` and only for its assigned reviewer; a successful edit SHALL refresh the stored AI summary asynchronously.

#### Scenario: Edit updates fields and re-scores

- **WHEN** the assignee updates an `IN_REVIEW` application with changed fields (e.g. requested amount, business type)
- **THEN** the stable columns and `rawData` reflect the change and the score (`score`/`riskBand`/`recommendation`/`scoreData`) is recomputed

#### Scenario: Pipeline state is preserved

- **WHEN** an application is edited
- **THEN** its `status`, assignment and decision fields, contract metadata, and `customerId`/`loanId` are unchanged

#### Scenario: Editing outside IN_REVIEW is blocked

- **WHEN** an application that is `RECEIVED`, `PENDING_DECISION`, `APPROVED` or terminal is edited
- **THEN** the request fails with CONFLICT

#### Scenario: Only the assignee edits

- **WHEN** a reviewer (or admin) who is not the assignee edits an `IN_REVIEW` application
- **THEN** the request is rejected as forbidden

#### Scenario: Edit fixes conversion-blocking data

- **WHEN** an application's `idNumber` was not in cédula format and the assignee corrects it via edit
- **THEN** the stable `idNumber` is updated so the application can later be converted

#### Scenario: Edit is restricted to reviewers

- **WHEN** a caller without `ADMIN` or `REVIEWER` invokes `updateApplication`
- **THEN** the request is rejected as forbidden
