## MODIFIED Requirements

### Requirement: ApplicationStatus enum covers the full lifecycle

The system SHALL define an `ApplicationStatus` enum with values `DRAFT`, `RECEIVED`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `SIGNED`, `CONVERTED`, and `ABANDONED`. The previously reserved `AI_REVIEWED` value is removed: scoring is a derived attribute, not a pipeline stage. Only `DRAFT` and `RECEIVED` are assigned at intake; the remaining states are reserved for later phases.

#### Scenario: New application defaults to DRAFT

- **WHEN** a `LoanApplication` row is created without an explicit status
- **THEN** its status is `DRAFT`

#### Scenario: No AI_REVIEWED state exists

- **WHEN** an application is scored
- **THEN** its status is unchanged by scoring (scoring does not move it to a "scored" or "AI reviewed" state)

## ADDED Requirements

### Requirement: LoanApplication stores its latest score

The `LoanApplication` model SHALL persist the full scoring result and extracted columns: `scoreData` (Json, the complete `ApplicationScore`), `score` (Int, the ISC), `riskBand` (String), `recommendation` (String), and `scoredAt` (DateTime).

#### Scenario: Score columns populated on write

- **WHEN** an application is upserted
- **THEN** `scoreData`, `score`, `riskBand`, `recommendation`, and `scoredAt` reflect the latest engine result

#### Scenario: Internal read procedures expose the score

- **WHEN** an authenticated caller lists or gets applications
- **THEN** the returned rows include the score columns and `scoreData`
