## ADDED Requirements

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

The system SHALL define an `ApplicationStatus` enum with values `DRAFT`, `RECEIVED`, `AI_REVIEWED`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `SIGNED`, `CONVERTED`, and `ABANDONED`. Only `DRAFT` and `RECEIVED` are assigned in this phase; the others are reserved for later phases.

#### Scenario: New application defaults to DRAFT

- **WHEN** a `LoanApplication` row is created without an explicit status
- **THEN** its status is `DRAFT`

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
