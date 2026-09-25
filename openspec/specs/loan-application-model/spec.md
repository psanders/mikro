# loan-application-model Specification

## Purpose

TBD - created by archiving change add-loan-application-intake. Update Purpose after archive.

## Requirements

### Requirement: LoanApplication persists submissions on a stable schema

The system SHALL provide a `LoanApplication` model that stores each submission with a unique `sessionId`, a status, stable English-named extracted fields, and a `rawData` JSON column holding the full normalized payload.

#### Scenario: Stable fields are populated from a complete submission

- **WHEN** a complete submission is stored
- **THEN** the row has `firstName`, `lastName`, `phone`, `idNumber`, `dateOfBirth`, `maritalStatus`, `businessType`, `businessName`, `requestedAmount`, `purpose`, `requestedTermWeeks`, `province`, and `homeAddress` populated from the payload
- **AND** `rawData` contains the entire normalized payload

#### Scenario: rawData buffers unknown or extra fields

- **WHEN** the payload contains fields not mapped to a stable column
- **THEN** those fields are preserved in `rawData`
- **AND** the write succeeds without error

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

### Requirement: Conversion foreign keys are reserved

The `LoanApplication` model SHALL include nullable `customerId` and `loanId` columns, unused in this phase, reserved for Phase 3 conversion.

#### Scenario: Conversion FKs are null on intake

- **WHEN** an application is created via intake
- **THEN** `customerId` and `loanId` are null

### Requirement: normalizeApplication parses the form payload into stable fields

The system SHALL provide a pure `normalizeApplication(raw)` function that parses the form's formatted values into typed stable fields and splits stable columns from the `rawData` buffer, tolerating missing fields. The form posts English keys, so no language translation is performed.

#### Scenario: Currency string parses to a numeric amount

- **WHEN** `requestedAmount` is the string `"50,000"`
- **THEN** the parsed `requestedAmount` is the numeric value `50000`

#### Scenario: Term string parses to an integer week count

- **WHEN** `requestedTermWeeks` is the string `"18 semanas"`
- **THEN** the parsed `requestedTermWeeks` is `18`

#### Scenario: Phone parses to E.164

- **WHEN** `phone` is `"(829) 871-7987"`
- **THEN** the parsed `phone` is `"+18298717987"`

#### Scenario: Partial payload normalizes with nulls

- **WHEN** a payload contains only `firstName` and `phone`
- **THEN** normalization succeeds with those fields set and all other stable fields null
- **AND** all provided fields are preserved in `rawData`

### Requirement: LoanApplication stores its latest score

The `LoanApplication` model SHALL persist the full scoring result and extracted columns: `scoreData` (Json, the complete `ApplicationScore`), `score` (Int, the ISC), `riskBand` (String), `recommendation` (String), and `scoredAt` (DateTime).

#### Scenario: Score columns populated on write

- **WHEN** an application is upserted
- **THEN** `scoreData`, `score`, `riskBand`, `recommendation`, and `scoredAt` reflect the latest engine result

#### Scenario: Internal read procedures expose the score

- **WHEN** an authenticated caller lists or gets applications
- **THEN** the returned rows include the score columns and `scoreData`

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

### Requirement: LoanApplication records its creation source

The `LoanApplication` model SHALL include an `ApplicationSource` enum (`FORM`, `WHATSAPP`, `MANUAL`) and a non-nullable `source` column defaulting to `FORM`. The `source` field SHALL be set at creation time and SHALL NOT change after that.

#### Scenario: Form submission source is FORM

- **WHEN** an application is created via `POST /v1/applications`
- **THEN** its `source` is `FORM`

#### Scenario: WhatsApp Flow submission source is WHATSAPP

- **WHEN** an application is created or updated via `submitApplicationFromFlow`
- **THEN** its `source` is `WHATSAPP`

#### Scenario: Manual creation source is MANUAL

- **WHEN** a reviewer calls `createApplication`
- **THEN** its `source` is `MANUAL`

#### Scenario: Existing rows default to FORM

- **WHEN** the migration runs on an existing database
- **THEN** all pre-existing `LoanApplication` rows have `source = FORM`

### Requirement: FollowUpJob table persists timer state

The system SHALL have a `FollowUpJob` model with columns: `id` (cuid), `applicationId` (FK to `LoanApplication`), `type` (`NUDGE` | `ABANDON`), `scheduledFor` (DateTime), `status` (`PENDING` | `DONE` | `CANCELLED`), `createdAt` (DateTime). The table is indexed on `(status, scheduledFor)` for polling efficiency.

#### Scenario: NUDGE job row created on application receipt

- **WHEN** an external application is received
- **THEN** a `FollowUpJob` row exists with the correct `applicationId`, `type: NUDGE`, `status: PENDING`, and a `scheduledFor` approximately 10 minutes in the future

#### Scenario: ABANDON job row created after NUDGE fires

- **WHEN** a NUDGE job is processed
- **THEN** a new `FollowUpJob` row is inserted with `type: ABANDON` and `scheduledFor` approximately 8 hours in the future (or now if no phone)

#### Scenario: Cancelled jobs are queryable for audit

- **WHEN** a job is cancelled because the application advanced
- **THEN** the `FollowUpJob` row remains with `status: CANCELLED` and is not deleted

### Requirement: LoanApplication stores contract and conversion links

The `LoanApplication` model SHALL persist signed-contract metadata — `contractFilename`, `contractOriginalName`, `contractMimeType`, `contractSize`, `contractSha256`, `signedById`, `signedAt` — and populate the reserved `customerId`/`loanId` columns on conversion.

#### Scenario: Contract metadata set on signing

- **WHEN** a signed contract is uploaded
- **THEN** the contract metadata columns and `signedById`/`signedAt` are populated

#### Scenario: Conversion links are set

- **WHEN** an application is converted
- **THEN** `customerId` and `loanId` reference the created (or reused) `Customer` and the new `Loan`

#### Scenario: Read procedures expose contract + link fields

- **WHEN** a reviewer lists or gets applications
- **THEN** the returned rows include the contract metadata and `customerId`/`loanId`
