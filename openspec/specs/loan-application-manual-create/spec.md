# loan-application-manual-create Specification

## Purpose

TBD - created by syncing change create-application-manual. Update Purpose after archive.

## Requirements

### Requirement: Reviewer can manually create a loan application

A reviewer SHALL be able to create a new `LoanApplication` record from the ops dashboard without requiring a website form submission. The record is created in `DRAFT` status with a server-generated `sessionId`. The mutation runs the same normalization and scoring pipeline as `updateApplication`.

#### Scenario: Create with minimum fields succeeds

- **WHEN** a reviewer submits the "Nueva solicitud" modal with at least one field filled
- **THEN** a new `LoanApplication` is created with status `DRAFT`
- **AND** the response includes the full application record (id, status, normalized fields, score)

#### Scenario: Navigate to detail after creation

- **WHEN** the mutation succeeds
- **THEN** the modal closes and the app navigates to `/solicitudes/:id` for the new application

#### Scenario: Empty patch is accepted

- **WHEN** a reviewer submits the modal with no fields filled
- **THEN** a `LoanApplication` is created in `DRAFT` with all nullable columns set to `null` and score `0`

#### Scenario: Normalization and scoring run on creation

- **WHEN** the reviewer enters `requestedAmount` = "50,000" and `requestedTermWeeks` = "10 semanas"
- **THEN** the stored `requestedAmount` is `50000` (integer), `requestedTermWeeks` is `10`, and a non-null `score` is recorded

### Requirement: createApplication is reviewer-gated

The `createApplication` mutation SHALL require reviewer-level authentication. Unauthenticated or non-reviewer callers SHALL receive an authorization error.

#### Scenario: Unauthenticated call is rejected

- **WHEN** `createApplication` is called without a valid session
- **THEN** the server returns an UNAUTHORIZED error

#### Scenario: Non-reviewer role is rejected

- **WHEN** `createApplication` is called by a user without the reviewer role
- **THEN** the server returns a FORBIDDEN error
