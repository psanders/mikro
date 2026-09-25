## MODIFIED Requirements

### Requirement: ApplicationStatus enum covers the full lifecycle

The system SHALL define an `ApplicationStatus` enum with values `DRAFT`, `RECEIVED`, `IN_REVIEW`, `PENDING_DECISION`, `APPROVED`, `CONVERTED`, `REJECTED`, and `ABANDONED`. There is no `SIGNED` status: a stored signed contract is a requirement of conversion, not a stage. Scoring is a derived attribute, not a pipeline stage. Intake assigns `DRAFT` or `RECEIVED` (or `REJECTED` for out-of-area final website submissions).

#### Scenario: New application defaults to DRAFT

- **WHEN** a `LoanApplication` row is created without an explicit status
- **THEN** its status is `DRAFT`

#### Scenario: No AI_REVIEWED state exists

- **WHEN** an application is scored
- **THEN** its status is unchanged by scoring (scoring does not move it to a "scored" or "AI reviewed" state)

#### Scenario: Legacy SIGNED rows become APPROVED

- **WHEN** the migration runs on a database with `SIGNED` applications
- **THEN** they become `APPROVED` with their contract columns intact

### Requirement: LoanApplication records the latest review decision

The `LoanApplication` model SHALL persist assignment and decision columns separately:

- `assignedReviewerId`, `assignedAt`
- `reviewerRecommendation`, `sentToDecisionAt`
- `decidedById`, `decidedAt`, `decisionNote`
- `rejectionReason` (enum `ApplicationRejectionReason`)
- `approvedAmount`, `approvedTermWeeks`
- `aiSummary`, `aiSummaryAt`

The former `reviewedById`/`reviewedAt`/`reviewNote` columns are removed.

#### Scenario: Assignment and decision are distinct

- **WHEN** reviewer A is assigned and admin B approves
- **THEN** `assignedReviewerId` is A and `decidedById` is B

#### Scenario: Legacy review audit migrates

- **WHEN** the migration runs on a `REJECTED` row whose `reviewNote` is `OUT_OF_COVERAGE_AREA`
- **THEN** it has `rejectionReason = OUT_OF_COVERAGE_AREA` and no `decisionNote`

#### Scenario: Internal read procedures expose the decision fields

- **WHEN** an authenticated reviewer lists or gets applications
- **THEN** the returned rows include the assignment, decision, approved-terms and AI summary fields
