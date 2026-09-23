## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: The generated contract prints the approved terms and binds the loan

Generating the contract of an application SHALL be allowed only while it is `APPROVED`, only for its assignee or an admin. The contract SHALL print the application's `approvedAmount` as principal (never the requested amount), and its terms (installments, installment amount, frequency, first installment date) SHALL be stored on the application as `contractTerms`. Conversion SHALL refuse a loan whose installments, installment amount or frequency differ from the stored `contractTerms` (reason `TERMS_MISMATCH`). Applications whose contract predates this rule have no stored terms and convert with the operator's terms.

#### Scenario: Contract uses the approved amount

- **WHEN** an application requested RD$15,000, was approved for RD$10,000, and its contract is generated
- **THEN** the contract principal is RD$10,000 and its terms are stored

#### Scenario: Loan must match the signed contract

- **WHEN** conversion is requested with an installment amount different from the stored contract terms
- **THEN** the request fails with BAD_REQUEST and nothing is created
