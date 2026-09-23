## MODIFIED Requirements

### Requirement: Convert a signed application into a Customer and Loan

The assigned reviewer or an admin SHALL be able to convert an `APPROVED` application **that has a stored signed contract** into a `Customer` + `Loan`, atomically, setting the application to `CONVERTED` and linking the created records. The loan principal SHALL equal the application's `approvedAmount`. The disbursement SHALL be posted to the caller-chosen `accountId`, defaulting to `accounting.disbursementAccountId`. In the same atomic operation, every document stored on the application SHALL be copied into `CustomerDocument` records (`source: MIGRATED_FROM_APPLICATION`) owned by the resulting customer, by reference to the existing sha256-keyed files: signed contract, ID front/back, business photos, and other documents.

#### Scenario: Conversion creates customer, loan and disbursement

- **WHEN** the assignee converts an `APPROVED` application with a stored contract, principal equal to `approvedAmount`, and account X
- **THEN** a `Loan` is created with those terms, a `Customer` exists for the applicant, a WITHDRAWAL of the principal is posted on account X, the application's `customerId`/`loanId` are set, and its status becomes `CONVERTED`

#### Scenario: Default disbursement account

- **WHEN** conversion is requested without `accountId`
- **THEN** the disbursement posts to `accounting.disbursementAccountId`

#### Scenario: Principal must match the approved amount

- **WHEN** conversion is requested with a principal different from `approvedAmount`
- **THEN** the request fails with CONFLICT and nothing is created

#### Scenario: Missing contract blocks conversion

- **WHEN** an `APPROVED` application without a stored contract is converted
- **THEN** the request fails with reason `CONTRACT_REQUIRED`

#### Scenario: Conversion is atomic

- **WHEN** loan creation fails during conversion (e.g. invalid terms)
- **THEN** no `Customer`, `Loan`, ledger transaction or `CustomerDocument` is left created and the application stays `APPROVED`

#### Scenario: Converting a non-approved application is rejected

- **WHEN** an application that is not `APPROVED` is converted
- **THEN** the request fails with an error naming the current status

#### Scenario: Double conversion is blocked

- **WHEN** an application that already has `customerId`/`loanId` set is converted
- **THEN** the request fails (already converted)

#### Scenario: Invalid applicant data blocks conversion

- **WHEN** the application's `idNumber` is not in cédula format `000-0000000-0`
- **THEN** the request fails with an error identifying the field to fix

#### Scenario: All stored documents are migrated to the customer

- **WHEN** an application with a contract, ID front/back and three business photos is converted
- **THEN** the resulting customer has 6 `CustomerDocument` rows (`CONTRACT`, `ID_FRONT`, `ID_BACK`, 3× `BUSINESS_PHOTO`) referencing the same files, and the application's own documents are unchanged

### Requirement: Conversion is restricted to reviewers

Conversion SHALL be restricted by the transition table to the assigned reviewer or an ADMIN.

#### Scenario: Unassigned reviewer is forbidden

- **WHEN** a REVIEWER who is not the assignee converts an application
- **THEN** the request is rejected as forbidden

#### Scenario: Non-reviewer is forbidden

- **WHEN** a user with only `COLLECTOR` converts an application
- **THEN** the request is rejected as forbidden
