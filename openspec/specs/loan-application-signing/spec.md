# loan-application-signing Specification

## Purpose

TBD - created by archiving change add-application-conversion. Update Purpose after archive.

## Requirements

### Requirement: Upload a signed contract

The assigned reviewer or an admin SHALL be able to upload (or replace) a signed contract PDF for an `APPROVED` application. This stores the file and records the contract metadata and `signedById`/`signedAt` **without changing the status**. The stored contract is what allows conversion.

#### Scenario: Upload keeps the application APPROVED

- **WHEN** the assignee uploads a PDF for an `APPROVED` application
- **THEN** the bytes are stored under the configured contracts path, contract metadata (`contractFilename`, `contractOriginalName`, `contractMimeType`, `contractSize`, `contractSha256`) and `signedById`/`signedAt` are recorded, and the status stays `APPROVED`

#### Scenario: Only PDFs are accepted

- **WHEN** a non-PDF mime type is uploaded
- **THEN** the request fails validation

#### Scenario: Oversized contract is rejected

- **WHEN** the uploaded file exceeds the size cap
- **THEN** the request fails validation

#### Scenario: Uploading for a non-APPROVED application is rejected

- **WHEN** a contract is uploaded for an application that is not `APPROVED`
- **THEN** the request fails with an error naming the current status

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

### Requirement: Generated contract renders human-readable labels

When the loan-contract PDF is generated for an application, enumerated applicant fields SHALL be rendered as their human-readable Spanish labels, not as raw enum codes. Specifically, the debtor's city/province SHALL be resolved through `PROVINCE_LABELS` and the debtor's occupation (sourced from the applicant's business type) SHALL be resolved through `BUSINESS_TYPE_LABELS`. If a stored value has no matching label, the raw value SHALL be used as a fallback rather than dropped.

#### Scenario: Province renders as a label

- **WHEN** a contract is generated for an application whose `province` is `PUERTO_PLATA`
- **THEN** the contract text shows `Puerto Plata`, not `PUERTO_PLATA`

#### Scenario: Business type renders as the occupation label

- **WHEN** a contract is generated for an application whose `businessType` is `CENTRO_UNAS` and no occupation override is supplied
- **THEN** the contract occupation text shows `Centro de uñas`, not `CENTRO_UNAS`

#### Scenario: Reviewer override takes precedence

- **WHEN** the reviewer supplies an `occupation` override at generation time
- **THEN** the contract uses the override verbatim and does not consult `BUSINESS_TYPE_LABELS`

#### Scenario: Unmapped code falls back to the raw value

- **WHEN** a stored `province` or `businessType` value is not present in its label map
- **THEN** the contract prints the raw stored value rather than an empty or placeholder field

### Requirement: The generated contract prints the approved terms and binds the loan

Generating the contract of an application SHALL be allowed only while it is `APPROVED`, only for its assignee or an admin. The contract SHALL print the application's `approvedAmount` as principal (never the requested amount), and its terms (installments, installment amount, frequency, first installment date) SHALL be stored on the application as `contractTerms`. Conversion SHALL refuse a loan whose installments, installment amount or frequency differ from the stored `contractTerms` (reason `TERMS_MISMATCH`). Applications whose contract predates this rule have no stored terms and convert with the operator's terms.

#### Scenario: Contract uses the approved amount

- **WHEN** an application requested RD$15,000, was approved for RD$10,000, and its contract is generated
- **THEN** the contract principal is RD$10,000 and its terms are stored

#### Scenario: Loan must match the signed contract

- **WHEN** conversion is requested with an installment amount different from the stored contract terms
- **THEN** the request fails with BAD_REQUEST and nothing is created
