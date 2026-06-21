## MODIFIED Requirements

### Requirement: Reviewer can manually create a loan application

A reviewer SHALL be able to create a new `LoanApplication` record from the ops dashboard without requiring a website form submission. The record is created in `RECEIVED` status with `source: MANUAL`, a server-generated `sessionId`. The mutation runs the same normalization and scoring pipeline as `updateApplication`. No follow-up timer is scheduled for manually-created applications.

#### Scenario: Create with minimum fields succeeds

- **WHEN** a reviewer submits the "Nueva solicitud" modal with at least one field filled
- **THEN** a new `LoanApplication` is created with status `RECEIVED` and `source: MANUAL`
- **AND** the response includes the full application record (id, status, normalized fields, score)

#### Scenario: Manual application appears as Nueva immediately

- **WHEN** a reviewer creates an application
- **THEN** the application is immediately visible in the solicitudes list with status `RECEIVED` ("Nueva")
- **AND** no `FollowUpJob` is created for that application

#### Scenario: Navigate to detail after creation

- **WHEN** the mutation succeeds
- **THEN** the modal closes and the app navigates to `/solicitudes/:id` for the new application

#### Scenario: Empty patch is accepted

- **WHEN** a reviewer submits the modal with no fields filled
- **THEN** a `LoanApplication` is created in `RECEIVED` with `source: MANUAL`, all nullable columns set to `null` and score `0`

#### Scenario: Normalization and scoring run on creation

- **WHEN** the reviewer enters `requestedAmount` = "50,000" and `requestedTermWeeks` = "10 semanas"
- **THEN** the stored `requestedAmount` is `50000` (integer), `requestedTermWeeks` is `10`, and a non-null `score` is recorded
