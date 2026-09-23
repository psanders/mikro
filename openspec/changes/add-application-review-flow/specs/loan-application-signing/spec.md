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
