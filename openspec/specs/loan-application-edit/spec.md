# loan-application-edit Specification

## Purpose

TBD - created by archiving change add-solicitud-edit-and-polish. Update Purpose after archive.

## Requirements

### Requirement: Reviewers can edit an application's fields

The system SHALL provide a reviewer-gated `updateApplication` mutation that merges a patch of editable fields into an application, re-derives its stable columns, recomputes its score, and persists — without changing status, review audit, contract, or conversion fields.

#### Scenario: Edit updates fields and re-scores

- **WHEN** a reviewer updates an application with changed fields (e.g. requested amount, business type)
- **THEN** the stable columns and `rawData` reflect the change and the score (`score`/`riskBand`/`recommendation`/`scoreData`) is recomputed

#### Scenario: Pipeline state is preserved

- **WHEN** an application is edited
- **THEN** its `status`, review audit, contract metadata, and `customerId`/`loanId` are unchanged

#### Scenario: Editing a converted application is blocked

- **WHEN** a reviewer attempts to edit a `CONVERTED` application
- **THEN** the request fails (the record is locked after conversion)

#### Scenario: Edit fixes conversion-blocking data

- **WHEN** an application's `idNumber` was not in cédula format and a reviewer corrects it via edit
- **THEN** the stable `idNumber` is updated so the application can later be converted

#### Scenario: Edit is restricted to reviewers

- **WHEN** a caller without `ADMIN` or `REVIEWER` invokes `updateApplication`
- **THEN** the request is rejected as forbidden
