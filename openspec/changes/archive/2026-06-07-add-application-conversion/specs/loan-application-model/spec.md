## ADDED Requirements

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
