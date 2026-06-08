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

The system SHALL define an `ApplicationStatus` enum with values `DRAFT`, `RECEIVED`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `SIGNED`, `CONVERTED`, and `ABANDONED`. The previously reserved `AI_REVIEWED` value is removed: scoring is a derived attribute, not a pipeline stage. Only `DRAFT` and `RECEIVED` are assigned at intake; the remaining states are reserved for later phases.

#### Scenario: New application defaults to DRAFT

- **WHEN** a `LoanApplication` row is created without an explicit status
- **THEN** its status is `DRAFT`

#### Scenario: No AI_REVIEWED state exists

- **WHEN** an application is scored
- **THEN** its status is unchanged by scoring (scoring does not move it to a "scored" or "AI reviewed" state)

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

The `LoanApplication` model SHALL persist review audit columns: `reviewedById` (String, the deciding admin's user id), `reviewedAt` (DateTime), and `reviewNote` (String, the rejection reason or approval/reopen note). These reflect the most recent review action.

#### Scenario: Decision columns set on a review action

- **WHEN** an admin claims, approves, rejects, or reopens an application
- **THEN** `reviewedById` and `reviewedAt` reflect the caller and the time of the action

#### Scenario: Rejection reason persisted

- **WHEN** an application is rejected with a reason
- **THEN** `reviewNote` holds that reason

#### Scenario: Internal read procedures expose the review fields

- **WHEN** an authenticated caller lists or gets applications
- **THEN** the returned rows include `reviewedById`, `reviewedAt`, and `reviewNote`

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
