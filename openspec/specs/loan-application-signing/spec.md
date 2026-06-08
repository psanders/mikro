# loan-application-signing Specification

## Purpose

TBD - created by archiving change add-application-conversion. Update Purpose after archive.

## Requirements

### Requirement: Upload a signed contract

A reviewer (ADMIN or REVIEWER) SHALL be able to upload a signed contract PDF for an `APPROVED` application, which stores the file and moves the application to `SIGNED`.

#### Scenario: Upload moves APPROVED to SIGNED

- **WHEN** a reviewer uploads a PDF for an `APPROVED` application
- **THEN** the bytes are stored under the configured contracts path, contract metadata (`contractFilename`, `contractOriginalName`, `contractMimeType`, `contractSize`, `contractSha256`) and `signedById`/`signedAt` are recorded, and status becomes `SIGNED`

#### Scenario: Only PDFs are accepted

- **WHEN** a non-PDF mime type is uploaded
- **THEN** the request fails validation

#### Scenario: Oversized contract is rejected

- **WHEN** the uploaded file exceeds the size cap
- **THEN** the request fails validation

#### Scenario: Signing a non-APPROVED application is rejected

- **WHEN** a reviewer uploads a contract for an application that is not `APPROVED`
- **THEN** the request fails with an error naming the current and attempted status

### Requirement: Read back a stored contract

A reviewer SHALL be able to retrieve the stored signed contract for an application.

#### Scenario: Contract returned as base64

- **WHEN** a reviewer requests the contract for an application that has one
- **THEN** the stored PDF is returned (base64) with its metadata

#### Scenario: No contract present

- **WHEN** a reviewer requests the contract for an application without one
- **THEN** the request returns a not-found error

### Requirement: Signing actions are restricted to reviewers

Contract upload and read SHALL be restricted to callers whose roles include `ADMIN` or `REVIEWER`.

#### Scenario: Non-reviewer is forbidden

- **WHEN** an authenticated user without `ADMIN` or `REVIEWER` invokes upload or read
- **THEN** the request is rejected as forbidden
